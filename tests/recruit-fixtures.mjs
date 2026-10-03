// Explicit inventory for tests about growth/combat, not invitation affordability.
export function provisionTravellers(run) {
  for(const key of Object.keys(run.party.ingredients))run.party.ingredients[key]=30;
  for(const key of ['stew','broth','skewer','soup','bento','salad'])run.party.meals[key]=30;
  run.party.journey.scrap=30;
  for(const key of Object.keys(run.party.journey.materials))run.party.journey.materials[key]=30;
  run.bag.ration=30;run.bag.arrow=30;
  return run;
}
