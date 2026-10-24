export const chocolateColors = { body: '#513025', face: '#654030', groove: '#40271e' };
export const STRAWBERRY_MODEL_SCALE = 0.78;

export const bases = [
  { id: 'vanilla', name: '香草蛋糕', en: 'Vanilla chiffon', color: '#dcb980', note: '柔软轻盈，藏着淡淡香草气息' },
  { id: 'chocolate', name: '巧克力蛋糕', en: 'Chocolate sponge', color: '#704331', note: '醇厚可可，给甜蜜一点深度' },
  { id: 'matcha', name: '抹茶蛋糕', en: 'Matcha chiffon', color: '#8e9c62', note: '温柔茶香，清新而不张扬' },
];
export const frostings = [
  { id: 'cream', name: '原味奶油', en: 'Fresh cream', color: '#fff2dc', note: '细腻绵密，最纯粹的奶香' },
  { id: 'strawberry', name: '草莓奶油', en: 'Strawberry cream', color: '#e99ba0', note: '一抹粉色，轻盈的莓果香' },
  { id: 'cocoa', name: '巧克力奶油', en: 'Chocolate cream', color: chocolateColors.face, note: '醇厚可可，绵密柔滑的奶油霜' },
];

export function resolveFrostingColor(color) {
  if (color === '#743c26' || color === '#92634f') return chocolateColors.face;
  if (color === '#efbbbe') return frostings[1].color;
  return color;
}
export const fruits = [
  { id: 'strawberry', name: '草莓', en: 'Strawberry', color: '#cd4e47', radius: 0.26 * STRAWBERRY_MODEL_SCALE },
  { id: 'blueberry', name: '蓝莓', en: 'Blueberry', color: '#586284', radius: 0.17 },
  { id: 'cherry', name: '樱桃', en: 'Cherry', color: '#a63c3c', radius: 0.23 },
  { id: 'raspberry', name: '覆盆子', en: 'Raspberry', color: '#c55d6a', radius: 0.21 },
  { id: 'orange', name: '橙片', en: 'Orange slice', color: '#e9a354', radius: 0.29 },
];
export const decorations = [
  { id: 'rosette', name: '奶油花', en: 'Cream rosette', color: '#f3e0bd', radius: 0.22 },
  { id: 'chocolate', name: '巧克力片', en: 'Chocolate shard', color: '#654232', radius: 0.23 },
  { id: 'pearls', name: '糖珠', en: 'Sugar pearls', color: '#c3ab82', radius: 0.16 },
  { id: 'candle', name: '小蜡烛', en: 'Little candle', color: '#95a78c', radius: 0.12 },
];
export const toppings = [...fruits, ...decorations];
export const steps = [
  { name: '蛋糕底', en: 'The base', title: '美好，从这里开始。', subtitle: '选一款喜欢的蛋糕底', items: bases },
  { name: '奶油', en: 'The frosting', title: '裹上一层温柔。', subtitle: '为蛋糕挑选一层细腻奶油', items: frostings },
  { name: '水果', en: 'The fruit', title: '添一点，自然甜。', subtitle: '挑选今日份的新鲜果实', items: fruits },
  { name: '装饰', en: 'The little details', title: '最后一点小心意。', subtitle: '把你的灵感，变成甜蜜细节', items: decorations },
];
