#property strict
#property version "1.00"
#property description "Authorization integration example only. Contains no trading strategy."
#include "NexusRuntime.mqh"
// The developer must replace this with the site's product ID before compiling a protected EA.
#define NEXUS_PRODUCT_ID 0
input string AuthorizationCode="";
input string TelemetryToken="";
input bool ConsentToReporting=false;
CNexusRuntime nexus;
int OnInit()
{
   if(AuthorizationCode==""||NEXUS_PRODUCT_ID<1)return INIT_PARAMETERS_INCORRECT;
   if(!nexus.Configure("https://nqstrategy.com",NEXUS_PRODUCT_ID,AuthorizationCode,TelemetryToken,ConsentToReporting,998862))return INIT_PARAMETERS_INCORRECT;
   EventSetTimer(1);return INIT_SUCCEEDED;
}
void OnTimer(){nexus.Poll();}
void OnTick()
{
   // In the real EA, always run existing protective position management FIRST.
   // ManageExistingPositions();
   if(!nexus.CanOpenNewTrades())return;
   // Existing new-entry logic goes here. No trading logic is implemented in this example.
}
void OnDeinit(const int reason){EventKillTimer();}
