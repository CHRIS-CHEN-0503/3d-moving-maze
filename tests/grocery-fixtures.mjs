import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),E=require('../story/tower-encounters.js');
export function grocerySeed(floor=99){
  for(let seed=1;seed<=1000;seed++)if(E.merchantOffers(floor,seed).some(m=>m.id==='suHe'))return seed;
  throw new Error('No grocery fixture in bounded seed search');
}
export const groceryShop=run=>E.merchantOffers(run.floor,run.seed,!!run.party?.loadouts).find(m=>m.id==='suHe');
