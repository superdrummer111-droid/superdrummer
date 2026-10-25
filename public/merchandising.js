import {masterFor} from './item-master.js';
const BRAND_RULES=[['뉴앤힐',/뉴\s*(?:앤|&|엔)\s*힐|new\s*(?:&|and|n)\s*heal/iu],['뉴트리탑',/뉴\s*트리\s*탑|nutri\s*top/iu]];
const CATEGORIES=['사료','영양제','세정제','미분류'];
export {CATEGORIES};
export const productIdentity=row=>JSON.stringify([row.platform,row.vendorItemId]);
export function productProfile(row,override={}){
 const original=String(row.productName||'이름 없음').normalize('NFKC');
 const master=masterFor(row.vendorItemId);
 const brand=master.brand||override.brand||BRAND_RULES.find(([,pattern])=>pattern.test(original))?.[0]||'기타 / 미분류';
 let category=CATEGORIES.includes(master.category)?master.category:CATEGORIES.includes(override.category)?override.category:undefined;
 if(!category){
  const text=original+' '+(row['item.productCategoryLevel1']||'')+' '+(row['item.productCategoryLevel2']||'');
  category=/세정|세척|클리너|샴푸|치약|소독|탈취|워시|cleanser|shampoo/iu.test(text)?'세정제':/영양제|보조제|유산균|오메가|비타민|영양보충|supplement|probiotic/iu.test(text)?'영양제':/사료|건식|습식|주식캔|키블|dog\s*food|cat\s*food/iu.test(text)?'사료':'미분류';
 }
 let name=original.replace(/유한\s*양행/gu,' ').replace(/\[\s*(?:공식|정품|특가|무료배송)[^\]]*\]|무료\s*배송|국내\s*배송|공식\s*판매|정품/gu,' ');
 let packSize=1;
 // Only explicit pack markers are removed. 60정, 100g, 30개입 remain capacities.
 const packs=[...name.matchAll(/(?:^|[\s,;(])([1-9]\d{0,2})\s*(개|팩|봉|병|통|박스|세트)(?!입|월|량)(?=\s*(?:묶음|구성|세트|$|[,;)\s]))/gu)];
 const multiplier=name.match(/(?:[x×*]\s*([1-9]\d{0,2})(?:\s*개)?|([1-9]\d{0,2})\s*(?:개|팩|병)\s*묶음)\s*$/iu);
 if(packs.length)packSize=Number(packs.at(-1)[1]);
 else if(multiplier)packSize=Number(multiplier[1]||multiplier[2]);
 name=name.replace(/(?:^|[\s,;(])([1-9]\d{0,2})\s*(개|팩|봉|병|통|박스|세트)(?!입|월|량)(?=\s*(?:묶음|구성|세트|$|[,;)\s]))/gu,' ').replace(/(?:[x×*]\s*[1-9]\d{0,2}(?:\s*개)?|[1-9]\d{0,2}\s*(?:개|팩|병)\s*묶음)\s*$/iu,' ').replace(/묶음|구성/gu,' ').replace(/\s*[x×*]\s*$/iu,' ');
 if(override.packSize!=null&&Number.isInteger(Number(override.packSize))&&Number(override.packSize)>=1&&Number(override.packSize)<=999)packSize=Number(override.packSize);
 for(const [canonical,pattern]of BRAND_RULES)name=name.replace(new RegExp(pattern.source,'giu'),canonical);
 name=name.replace(/반려견/gu,'강아지').replace(/반려묘/gu,'고양이').replace(/[\[\](),;_\-]+/gu,' ').replace(/\s+/gu,' ').trim();
 if(master.name)name=master.name;
 const compact=name.toLowerCase().split(/\s+/u).sort().join('').replace(/[^\p{L}\p{N}.]/gu,'');
 const capacities=[...name.toLowerCase().matchAll(/\d+(?:\.\d+)?\s*(?:kg|mg|g|ml|l|정|캡슐|포|개입)/gu)].map(m=>m[0].replace(/\s/g,'')).sort().join('|');
 const variants=[...name.toLowerCase().matchAll(/어덜트|adult|퍼피|puppy|시니어|senior|키튼|kitten|고양이|강아지|연어|치킨|닭|소고기|양고기|오리|대형견|소형견/gu)].map(m=>m[0]).sort().join('|');
 const numbers=[...compact.matchAll(/\d+(?:\.\d+)?/g)].map(m=>m[0]).join('|');
 return {name,compact,brand,category,packSize,capacities,variants,numbers};
}
function grams(value){const result=new Set();for(let i=0;i<value.length-1;i++)result.add(value.slice(i,i+2));return result}
export function similarProducts(a,b){
 if(a.brand!==b.brand||a.category!==b.category||a.capacities!==b.capacities||a.variants!==b.variants||a.numbers!==b.numbers)return false;
 if(a.compact===b.compact)return true;
 if(Math.min(a.compact.length,b.compact.length)<8)return false;
 const x=grams(a.compact),y=grams(b.compact),intersection=[...x].filter(g=>y.has(g)).length;
 if(2*intersection/(x.size+y.size)>=0.9)return true;
 // Long matching names may contain a small typo; keep the same variant/capacity guards.
 const limit=Math.min(3,Math.floor(Math.max(a.compact.length,b.compact.length)*0.06));
 if(Math.min(a.compact.length,b.compact.length)<12||Math.abs(a.compact.length-b.compact.length)>limit)return false;
 let previous=Array.from({length:b.compact.length+1},(_,i)=>i);
 for(let i=1;i<=a.compact.length;i++){const current=[i];for(let j=1;j<=b.compact.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a.compact[i-1]===b.compact[j-1]?0:1));if(Math.min(...current)>limit)return false;previous=current;}
 return previous[b.compact.length]<=limit;
}
export function aggregateMerchandise(rows,overrides={}){
 const groups=[],brands=new Map(),categories=new Map(CATEGORIES.map(c=>[c,0]));let quantity=0,revenue=0,orderedQuantity=0;
 for(const row of rows){
  const profile=productProfile(row,overrides[productIdentity(row)]),units=row.quantity*profile.packSize;
  quantity+=units;orderedQuantity+=row.quantity;revenue+=row.revenue;
  brands.set(profile.brand,(brands.get(profile.brand)||0)+row.revenue);categories.set(profile.category,(categories.get(profile.category)||0)+row.revenue);
  let group=groups.find(g=>g.currency===row.currency&&similarProducts(g.profile,profile));
  if(!group){group={profile,currency:row.currency,productName:profile.name,brand:profile.brand,category:profile.category,quantity:0,orderedQuantity:0,revenue:0,platforms:new Set(),variants:new Map()};groups.push(group)}
  group.quantity+=units;group.orderedQuantity+=row.quantity;group.revenue+=row.revenue;group.platforms.add(row.platform);
  const key=productIdentity(row),variant=group.variants.get(key)||{key,platform:row.platform,vendorItemId:row.vendorItemId,productName:row.productName,packSize:profile.packSize,quantity:0,units:0,revenue:0};variant.quantity+=row.quantity;variant.units+=units;variant.revenue+=row.revenue;group.variants.set(key,variant);
 }
 return {quantity,orderedQuantity,revenue,brands,categories,products:groups.sort((a,b)=>b.revenue-a.revenue)};
}
