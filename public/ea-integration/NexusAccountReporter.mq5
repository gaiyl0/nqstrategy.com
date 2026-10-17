#property strict
#property version "1.00"
#property description "Read-only Nexus account reporting. Does not open, close or modify trades."
#include "NexusRuntime.mqh"
input string WebsiteOrigin="https://nqstrategy.com";
input int ProductId=0;
input string TelemetryToken="";
input bool ConsentToReporting=false;
input long EaMagicNumber=998862;
CNexusRuntime nexus;
int OnInit()
{
   if(!ConsentToReporting||TelemetryToken==""||ProductId<1)return INIT_PARAMETERS_INCORRECT;
   if(!nexus.Configure(WebsiteOrigin,ProductId,"",TelemetryToken,ConsentToReporting,EaMagicNumber))return INIT_PARAMETERS_INCORRECT;
   EventSetTimer(1);return INIT_SUCCEEDED;
}
void OnTimer(){nexus.Poll();}
void OnDeinit(const int reason){EventKillTimer();}
