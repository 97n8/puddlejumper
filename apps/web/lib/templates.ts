// Template scaffolding for the "+ Process" picker.
//
// NOTE: the resumed Phase 5 prompt cites "9 templates from pj-single-v2.html
// TMPLS array".  That file is not in this repo, so the nine below are
// best-fit fillers spanning the three Spec domains (Campaign, PublicLogic,
// Personal).  Swap them when the original TMPLS is recovered.

export type TemplateDomain = 'Campaign' | 'PublicLogic' | 'Personal';

export interface ProcessTemplate {
  id: string;
  label: string;
  domain: TemplateDomain;
  steps: string[];
  default_automation?: AutomationOption;
}

export type AutomationOption =
  | 'none'
  | 'remind_only'
  | 'remind_and_calendar'
  | 'full_cal_layer'
  | 'digest_only';

export const AUTOMATIONS: ReadonlyArray<{ id: AutomationOption; label: string; hint: string }> = [
  { id: 'none',                label: 'No automation',          hint: 'Manual only' },
  { id: 'remind_only',         label: 'Reminders',              hint: 'Daily nudge to Google Tasks' },
  { id: 'remind_and_calendar', label: 'Reminders + Calendar',   hint: 'Adds deadline events' },
  { id: 'full_cal_layer',      label: 'Full CAL',               hint: 'Statutory clocks + notices' },
  { id: 'digest_only',         label: 'Weekly digest',          hint: 'Monday 7am summary email' },
];

export const TEMPLATES: ReadonlyArray<ProcessTemplate> = [
  // Campaign
  { id: 'door-knock-week',  label: 'Week of door-knocking',        domain: 'Campaign',
    steps: ['Pick precinct', 'Print walk list', 'Knock', 'Log responses', 'Send thank-you'],
    default_automation: 'remind_and_calendar' },
  { id: 'fundraiser',       label: 'Fundraiser event',             domain: 'Campaign',
    steps: ['Pick venue', 'Send invites', 'Confirm RSVPs', 'Day-of run-of-show', 'Send thanks'],
    default_automation: 'remind_and_calendar' },
  { id: 'mailer',           label: 'Direct mail piece',            domain: 'Campaign',
    steps: ['Draft copy', 'Design proof', 'Print quote', 'Approve', 'Drop date'],
    default_automation: 'remind_only' },

  // PublicLogic
  { id: 'prr-intake',       label: 'Public records request',       domain: 'PublicLogic',
    steps: ['Intake', 'Route to officer', 'Search', 'Review', 'Respond'],
    default_automation: 'full_cal_layer' },
  { id: 'procurement',      label: 'Procurement (c.30B)',          domain: 'PublicLogic',
    steps: ['Scope', 'Solicit', 'Evaluate', 'Award', 'Execute'],
    default_automation: 'full_cal_layer' },
  { id: 'meeting-c30a',     label: 'Open meeting (c.30A)',         domain: 'PublicLogic',
    steps: ['Post notice', 'Hold meeting', 'Draft minutes', 'Approve', 'Publish'],
    default_automation: 'full_cal_layer' },

  // Personal
  { id: 'doctor-visit',     label: 'Doctor visit follow-through',  domain: 'Personal',
    steps: ['Book', 'Prep questions', 'Attend', 'Capture notes', 'Schedule follow-up'],
    default_automation: 'remind_only' },
  { id: 'taxes',            label: 'File taxes',                   domain: 'Personal',
    steps: ['Gather docs', 'Enter income', 'Enter deductions', 'Review', 'File'],
    default_automation: 'remind_and_calendar' },
  { id: 'house-project',    label: 'House project',                domain: 'Personal',
    steps: ['Scope', 'Estimate', 'Pick contractor', 'Schedule', 'Sign off'],
    default_automation: 'digest_only' },
];
