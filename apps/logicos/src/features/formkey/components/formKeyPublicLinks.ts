import type { FKFormDefinition } from '@/services/pjApi'
import { pjBase } from '@/services/pjBase'

const PJ = pjBase

export function getPublicFormUrl(formId: string, embed = false): string {
  const url = new URL('/forms', window.location.origin)
  url.searchParams.set('id', formId)
  if (embed) url.searchParams.set('embed', '1')
  return url.toString()
}

export function getPublicSubmitUrl(formId: string): string {
  return `${PJ}/v1/forms/${encodeURIComponent(formId)}/submit`
}

export function getFormEmbedCode(form: Pick<FKFormDefinition, 'name' | 'formId'>): string {
  return `<iframe src="${getPublicFormUrl(form.formId, true)}" title="${form.name}" width="100%" height="960" style="border:0;border-radius:24px;overflow:hidden;" loading="lazy"></iframe>`
}
