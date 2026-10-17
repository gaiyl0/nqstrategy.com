#ifndef NEXUS_RUNTIME_MQH
#define NEXUS_RUNTIME_MQH
// Optional reporting and fail-closed entry authorization. No trade functions are called here.
// In a protected EA, the developer must compile the assigned product ID into the program.
class CNexusRuntime
{
private:
   string m_origin,m_code,m_token,m_device,m_last_account,m_last_server;
   int m_product;
   long m_magic;
   bool m_reporting;
   ulong m_next_authorize,m_next_report,m_lease_deadline;
   string Escape(string value)
   {
      StringReplace(value,"\\","\\\\");StringReplace(value,"\"","\\\"");
      StringReplace(value,"\r","\\r");StringReplace(value,"\n","\\n");StringReplace(value,"\t","\\t");
      return value;
   }
   string DeviceId()
   {
      uchar data[],empty[],digest[];
      string raw=TerminalInfoString(TERMINAL_DATA_PATH)+"|"+TerminalInfoString(TERMINAL_NAME);
      int length=StringToCharArray(raw,data,0,WHOLE_ARRAY,CP_UTF8);
      if(length>0)ArrayResize(data,length-1);
      if(CryptEncode(CRYPT_HASH_SHA256,data,empty,digest)!=32)return "";
      string result="";
      for(int i=0;i<ArraySize(digest);i++)result+=StringFormat("%02x",(int)digest[i]);
      return result;
   }
   string Identity()
   {
      return StringFormat("\"productId\":%d,\"account\":\"%I64d\",\"server\":\"%s\",\"device\":\"%s\"",
         m_product,AccountInfoInteger(ACCOUNT_LOGIN),Escape(AccountInfoString(ACCOUNT_SERVER)),m_device);
   }
   int Post(string body,string &reply)
   {
      char data[],result[];string headers;
      int length=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
      if(length>0)ArrayResize(data,length-1);
      ResetLastError();
      int status=WebRequest("POST",m_origin+"/api/ea/runtime","Content-Type: application/json\r\n",2500,data,result,headers);
      reply=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
      // Never print request bodies, credentials or account identifiers.
      if(status!=200)PrintFormat("Nexus connection: HTTP %d, terminal error %d. Check URL permission and connection status.",status,GetLastError());
      return status;
   }
   bool ReadInteger(string json,string key,long &value)
   {
      string marker="\""+key+"\":";int start=StringFind(json,marker);
      if(start<0)return false;start+=StringLen(marker);
      int end=start;
      while(end<StringLen(json))
      {
         ushort ch=StringGetCharacter(json,end);
         if(ch<'0'||ch>'9')break;
         end++;
      }
      if(end==start)return false;
      value=StringToInteger(StringSubstr(json,start,end-start));return true;
   }
public:
   CNexusRuntime():m_product(0),m_magic(0),m_reporting(false),m_next_authorize(0),m_next_report(0),m_lease_deadline(0){}
   bool Configure(string origin,int product_id,string authorization_code,string telemetry_token,bool reporting,long ea_magic)
   {
      if(StringFind(origin,"https://")!=0||product_id<1)return false;
      while(StringLen(origin)>0&&StringSubstr(origin,StringLen(origin)-1)=="/")origin=StringSubstr(origin,0,StringLen(origin)-1);
      if(StringFind(StringSubstr(origin,8),"/")>=0||StringFind(origin,"?")>=0||StringFind(origin,"#")>=0||StringFind(origin,"@")>=0)return false;
      m_origin=origin;m_product=product_id;m_code=authorization_code;m_token=telemetry_token;m_reporting=reporting;m_magic=ea_magic;
      m_device=DeviceId();m_next_authorize=0;m_next_report=0;m_lease_deadline=0;
      return StringLen(m_device)==64;
   }
   void Poll()
   {
      // WebRequest is unavailable in the MT5 Strategy Tester; do not silently bypass authorization.
      if(MQLInfoInteger(MQL_TESTER))return;
      if(AccountInfoInteger(ACCOUNT_LOGIN)<=0||!TerminalInfoInteger(TERMINAL_CONNECTED)){m_lease_deadline=0;return;}
      ulong now=GetTickCount64();
      if(m_code!=""&&now>=m_next_authorize)
      {
         m_next_authorize=now+30000;
         string reply;
         int status=Post("{\"action\":\"authorize\",\"code\":\""+Escape(m_code)+"\","+Identity()+"}",reply);
         StringReplace(reply," ","");StringReplace(reply,"\n","");StringReplace(reply,"\r","");
         long lease=0,product=0;
         if(status==200&&StringFind(reply,"\"success\":true")>=0&&StringFind(reply,"\"valid\":true")>=0&&ReadInteger(reply,"leaseSeconds",lease)&&ReadInteger(reply,"productId",product)&&product==m_product&&lease>0&&lease<=60)
         {
            m_lease_deadline=now+(ulong)lease*1000;
            m_last_account=(string)AccountInfoInteger(ACCOUNT_LOGIN);m_last_server=AccountInfoString(ACCOUNT_SERVER);
         }
         else m_lease_deadline=0;
      }
      if(m_reporting&&m_token!=""&&now>=m_next_report)
      {
         m_next_report=now+30000;
         int all_positions=PositionsTotal(),ea_positions=0;double ea_profit=0;
         for(int i=all_positions-1;i>=0;i--)
         {
            if(PositionGetTicket(i)==0)continue;
            if(PositionGetInteger(POSITION_MAGIC)!=m_magic)continue;
            ea_positions++;ea_profit+=PositionGetDouble(POSITION_PROFIT)+PositionGetDouble(POSITION_SWAP);
         }
         // A persistent monotonic sequence avoids replay across EA removal/restart, without storing the credential.
         string sequence_name="NQ_SEQ_"+m_device+"_"+(string)m_product;
         sequence_name=StringSubstr(sequence_name,0,63);
         long sequence=(long)TimeGMT()*1000;
         if(GlobalVariableCheck(sequence_name))sequence=(long)MathMax((double)sequence,GlobalVariableGet(sequence_name)+1);
         GlobalVariableSet(sequence_name,(double)sequence);GlobalVariablesFlush();
         string body=StringFormat("{\"action\":\"heartbeat\",\"token\":\"%s\",%s,\"sequence\":%I64d,\"currency\":\"%s\",\"balance\":%.8f,\"equity\":%.8f,\"floatingProfit\":%.8f,\"freeMargin\":%.8f,\"positionsCount\":%d,\"eaPositionsCount\":%d,\"eaFloatingProfit\":%.8f}",
            Escape(m_token),Identity(),sequence,Escape(AccountInfoString(ACCOUNT_CURRENCY)),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY),AccountInfoDouble(ACCOUNT_PROFIT),AccountInfoDouble(ACCOUNT_MARGIN_FREE),all_positions,ea_positions,ea_profit);
         string reply;Post(body,reply);
      }
   }
   bool CanOpenNewTrades()
   {
      return m_code!=""&&GetTickCount64()<m_lease_deadline&&m_last_account==(string)AccountInfoInteger(ACCOUNT_LOGIN)&&m_last_server==AccountInfoString(ACCOUNT_SERVER);
   }
};
#endif
