export const integrationFiles=[
  {file:'NexusRuntime.mqh',label:'通用授权与上报组件'},
  {file:'NexusAccountReporter.mq5',label:'只读上报程序源码'},
  {file:'NexusAccountReporter.ex5',label:'只读上报程序 EX5'},
  {file:'NexusAuthorizationExample.mq5',label:'授权接入示例源码'},
];
export const integrationPackage='NexusEaIntegration.zip';
export const integrationDownloadHref=file=>`/ea-integration/download?file=${encodeURIComponent(file)}`;
