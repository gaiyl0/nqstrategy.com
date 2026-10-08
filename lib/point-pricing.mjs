export function pointPriceLabel(product,t){
  const points=Number(product?.points_price);
  if(Number.isInteger(points)&&points>0)return `${points.toLocaleString()} ${t('积分','points')}`;
  return Number(product?.price)>0?t('积分价格待设置','Points price pending'):t('免费','Free');
}
