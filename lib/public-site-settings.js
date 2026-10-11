import db from './db.js';
import {publishedSiteBrand} from './site-brand-store.js';
import {publicBrokerReward} from './point-journey.js';
import {DEFAULT_COMMUNITY_CONTENT,normalizeCommunityContent} from './community-content.js';

export const PUBLIC_SETTINGS_KEYS=new Set([
  'siteName','contactEmail','socialXUrl','telegramGroupUrl','primaryColor','frontendDesign','adminDesign','homeModules','featuredRotationSeconds','featuredAutoRotate','homeHeroTitle','homeHeroDescription','homeArticleCount',
  'broker1Name','broker1Desc','broker1Link','broker2Name','broker2Desc','broker2Link','broker3Name','broker3Desc','broker3Link',
  'exchangeAdEnabled','exchangeAdTitle','exchangeAdDescription','exchangeAdCta','exchangeAdUrl','exchangeAdCta2','exchangeAdUrl2','featuredProductIds',
  'mt5DownloadEnabled','mt5DownloadUrl','mt5DownloadLabel','mt5DownloadDescription','forumCategories','communityContent','forumNewsEnabled','forumStrategyOverviewEnabled',
]);
export function readPublicSiteSettings(){
  const settings={};
  for(const {key,value} of db.prepare('SELECT key,value FROM settings').all()){
    if(!PUBLIC_SETTINGS_KEYS.has(key))continue;
    if(key==='communityContent')settings[key]=normalizeCommunityContent(value)||DEFAULT_COMMUNITY_CONTENT;
    else if(['homeModules','featuredProductIds'].includes(key)){try{settings[key]=JSON.parse(value);}catch{settings[key]=[];}}
    else if(['featuredRotationSeconds','homeArticleCount'].includes(key))settings[key]=Number(value);
    else if(['featuredAutoRotate','exchangeAdEnabled','mt5DownloadEnabled','forumNewsEnabled','forumStrategyOverviewEnabled'].includes(key))settings[key]=value==='true';
    else settings[key]=value;
  }
  settings.siteBrand=publishedSiteBrand();settings.siteName=settings.siteBrand.name;
  settings.brokerReward=publicBrokerReward();
  settings.communityContent||=DEFAULT_COMMUNITY_CONTENT;
  return settings;
}
