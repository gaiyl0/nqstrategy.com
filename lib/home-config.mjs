import { z } from 'zod';

export const HOME_MODULES = ['hero','topics','featured','advertisement','discussions','articles','verification','brandIntro'];
export const HOME_MODULE_LABELS = {hero:'首屏介绍',topics:'黄金与 MT5 专题',featured:'精选商品',advertisement:'合作广告',discussions:'最新讨论列表',articles:'论坛最新文章',verification:'验证说明',brandIntro:'品牌介绍'};
export const homeConfigSchema = z.object({
  modules:z.array(z.enum(HOME_MODULES)).max(8).refine(items=>new Set(items).size===items.length,'首页模块不能重复'),
  heroTitle:z.string().trim().max(80), heroDescription:z.string().trim().max(300), heroKicker:z.string().trim().max(100),
  featuredTitle:z.string().trim().max(80), articlesTitle:z.string().trim().max(80),
  showPublish:z.boolean(), showLead:z.boolean(), heroAction:z.enum(['market','points','none']),
  showJourney:z.boolean().default(true),
  articleCount:z.number().int().min(1).max(12), rotationSeconds:z.number().int().min(3).max(60), autoRotate:z.boolean(),
}).strict();

export function defaultHomeConfig(settings={}) {
  let modules=settings.homeModules;
  if(typeof modules==='string'){try{modules=JSON.parse(modules);}catch{modules=undefined;}}
  const legacyDefault=['hero','topics','featured','advertisement','articles','verification'];
  if(Array.isArray(modules)&&JSON.stringify(modules)===JSON.stringify(legacyDefault))modules=['hero','topics','featured','advertisement','discussions','articles','verification'];
  const candidate={modules:Array.isArray(modules)?modules:['hero','topics','featured','advertisement','discussions','articles','verification'],
    heroTitle:settings.homeHeroTitle||'',heroDescription:settings.homeHeroDescription||'',heroKicker:'',featuredTitle:'',articlesTitle:'',
    showPublish:true,showLead:true,showJourney:true,heroAction:'market',articleCount:Number(settings.homeArticleCount)||4,
    rotationSeconds:Number(settings.featuredRotationSeconds)||6,autoRotate:settings.featuredAutoRotate!==false&&settings.featuredAutoRotate!=='false'};
  const parsed=homeConfigSchema.safeParse(candidate);
  return parsed.success?parsed.data:homeConfigSchema.parse({...candidate,modules:['hero','topics','featured','advertisement','discussions','articles','verification'],articleCount:4,rotationSeconds:6,heroTitle:'',heroDescription:''});
}

export function homeDisplaySettings(settings={}) {
  const home={...defaultHomeConfig(settings),...settings.siteBrand?.home};
  if(settings.siteBrand?.catalogEnabled===false){home.showLead=false;home.showPublish=false;home.modules=home.modules.filter(key=>key!=='featured');if(home.heroAction==='market')home.heroAction='none';}
  if(settings.siteBrand?.tasksEnabled===false){home.showJourney=false;if(home.heroAction==='points')home.heroAction='none';}
  return {...settings,homeModules:home.modules,homeHeroTitle:home.heroTitle,homeHeroDescription:home.heroDescription,
    homeArticleCount:home.articleCount,featuredRotationSeconds:home.rotationSeconds,featuredAutoRotate:home.autoRotate,home};
}

export const SITE_PRESETS = {
  ea:{label:'EA 积分站',description:'突出 EA、积分任务与论坛，适合注册入金、审核获积分、兑换下载的业务。',modules:['hero','topics','featured','advertisement','discussions','articles','verification'],title:'发现适合你的 EA 量化策略',descriptionText:'查阅真实资料，理解策略风险。连接 EA 开发者、黄金交易研究与量化社区。',kicker:'MT5 · XAUUSD · 外汇策略研究',featuredTitle:'精选 EA 策略',articlesTitle:'最新研究与社区动态',showPublish:true,showLead:true,heroAction:'market'},
  store:{label:'数字商品商城',description:'突出精选商品与品牌介绍，继续使用现有积分兑换和数字下载，不包含实体物流。',modules:['hero','featured','brandIntro'],title:'发现适合你的数字商品',descriptionText:'了解商品详情，使用积分兑换，并在个人中心管理下载与授权。',kicker:'数字商品 · 积分兑换',featuredTitle:'精选数字商品',articlesTitle:'社区动态',showPublish:false,showLead:true,heroAction:'market'},
  brand:{label:'品牌展示',description:'首页突出品牌内容，隐藏首页兑换与发布按钮。现有商品与任务地址仍可访问，论坛状态单独配置。',modules:['hero','brandIntro'],title:'认识我们的品牌',descriptionText:'了解我们的产品、服务与品牌故事。',kicker:'品牌 · 产品 · 服务',featuredTitle:'精选产品',articlesTitle:'品牌动态',showPublish:false,showLead:false,heroAction:'none'},
};

export function applySitePreset(config,key) {
  const preset=SITE_PRESETS[key];
  if(!preset)throw new Error('UNKNOWN_SITE_PRESET');
  const labels=key==='ea'?['首页','EA 下载','论坛','赚积分']:key==='store'?['首页','商品目录','论坛','积分任务']:['首页'];
  const targets=['home','market','forum','points'];
  const system=labels.map((label,index)=>({label,labelEn:['Home',key==='store'?'Products':'EA downloads','Forum','Points'][index],kind:'route',target:targets[index],visible:true}));
  return {...config,preset:key,navigation:[...system,...config.navigation.filter(item=>item.kind!=='route')].slice(0,8),
    home:{...(config.home||defaultHomeConfig()),modules:[...preset.modules],heroTitle:preset.title,heroDescription:preset.descriptionText,heroKicker:preset.kicker,
      featuredTitle:preset.featuredTitle,articlesTitle:preset.articlesTitle,showPublish:preset.showPublish,showLead:preset.showLead,showJourney:key==='ea',heroAction:preset.heroAction}};
}
