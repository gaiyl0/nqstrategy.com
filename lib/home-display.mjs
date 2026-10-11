export const HOME_MODULES = ['hero','topics','featured','advertisement','discussions','articles','verification','brandIntro'];
export const HOME_MODULE_LABELS = {hero:'首屏介绍',topics:'黄金与 MT5 专题',featured:'精选商品',advertisement:'合作广告',discussions:'最新讨论列表',articles:'论坛最新文章',verification:'验证说明',brandIntro:'品牌介绍'};
const DEFAULT_MODULES=['hero','topics','featured','advertisement','discussions','articles','verification'];
export function defaultHomeConfig(settings={}) {
  let modules=settings.homeModules;
  if(typeof modules==='string'){try{modules=JSON.parse(modules);}catch{modules=undefined;}}
  if(Array.isArray(modules)&&JSON.stringify(modules)===JSON.stringify(['hero','topics','featured','advertisement','articles','verification']))modules=[...DEFAULT_MODULES];
  const candidate={modules:Array.isArray(modules)?modules:[...DEFAULT_MODULES],heroTitle:settings.homeHeroTitle||'',heroDescription:settings.homeHeroDescription||'',heroKicker:'',featuredTitle:'',articlesTitle:'',showPublish:true,showLead:true,showJourney:true,heroAction:'market',articleCount:Number(settings.homeArticleCount)||4,rotationSeconds:Number(settings.featuredRotationSeconds)||6,autoRotate:settings.featuredAutoRotate!==false&&settings.featuredAutoRotate!=='false'};
  const valid=Array.isArray(candidate.modules)&&candidate.modules.length<=8&&new Set(candidate.modules).size===candidate.modules.length&&candidate.modules.every(key=>HOME_MODULES.includes(key))&&typeof candidate.heroTitle==='string'&&candidate.heroTitle.trim().length<=80&&typeof candidate.heroDescription==='string'&&candidate.heroDescription.trim().length<=300&&Number.isInteger(candidate.articleCount)&&candidate.articleCount>=1&&candidate.articleCount<=12&&Number.isInteger(candidate.rotationSeconds)&&candidate.rotationSeconds>=3&&candidate.rotationSeconds<=60;
  if(!valid)return {...candidate,modules:[...DEFAULT_MODULES],articleCount:4,rotationSeconds:6,heroTitle:'',heroDescription:''};
  return {...candidate,heroTitle:candidate.heroTitle.trim(),heroDescription:candidate.heroDescription.trim()};
}

export function homeDisplaySettings(settings={}) {
  const home={...defaultHomeConfig(settings),...settings.siteBrand?.home};
  if(settings.siteBrand?.catalogEnabled===false){home.showLead=false;home.showPublish=false;home.modules=home.modules.filter(key=>key!=='featured');if(home.heroAction==='market')home.heroAction='none';}
  if(settings.siteBrand?.tasksEnabled===false){home.showJourney=false;if(home.heroAction==='points')home.heroAction='none';}
  return {...settings,homeModules:home.modules,homeHeroTitle:home.heroTitle,homeHeroDescription:home.heroDescription,
    homeArticleCount:home.articleCount,featuredRotationSeconds:home.rotationSeconds,featuredAutoRotate:home.autoRotate,home};
}

