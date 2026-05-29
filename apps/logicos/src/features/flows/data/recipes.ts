import { recipesUtil } from './recipes-util'
import { recipesMicrosoft } from './recipes-microsoft'
import { recipesGoogle } from './recipes-google'
import { recipesGithub } from './recipes-github'
import { recipesCloud } from './recipes-cloud'
import { recipesLogicsuite } from './recipes-logicsuite'
import { recipesGovernance } from './recipes-governance'
import type { Recipe } from '../types'

export const RECIPES: Recipe[] = (() => {
  const all = [...recipesUtil, ...recipesMicrosoft, ...recipesGoogle, ...recipesGithub, ...recipesCloud, ...recipesLogicsuite, ...recipesGovernance]
  const seen = new Set<string>()
  return all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
})()
