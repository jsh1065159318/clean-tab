import variables from 'config/variables';

import * as ar from 'i18n/locales/achievements/ar.json';
import * as arz from 'i18n/locales/achievements/arz.json';
import * as az from 'i18n/locales/achievements/az.json';
import * as azb from 'i18n/locales/achievements/azb.json';
import * as bn from 'i18n/locales/achievements/bn.json';
import * as de_DE from 'i18n/locales/achievements/de_DE.json';
import * as el from 'i18n/locales/achievements/el.json';
import * as en_GB from 'i18n/locales/achievements/en_GB.json';
import * as en_US from 'i18n/locales/achievements/en_US.json';
import * as es from 'i18n/locales/achievements/es.json';
import * as es_419 from 'i18n/locales/achievements/es_419.json';
import * as et from 'i18n/locales/achievements/et.json';
import * as fa from 'i18n/locales/achievements/fa.json';
import * as fr from 'i18n/locales/achievements/fr.json';
import * as hu from 'i18n/locales/achievements/hu.json';
import * as id_ID from 'i18n/locales/achievements/id_ID.json';
import * as ja from 'i18n/locales/achievements/ja.json';
import * as lt from 'i18n/locales/achievements/lt.json';
import * as lv from 'i18n/locales/achievements/lv.json';
import * as nl from 'i18n/locales/achievements/nl.json';
import * as no from 'i18n/locales/achievements/no.json';
import * as peo from 'i18n/locales/achievements/peo.json';
import * as pt from 'i18n/locales/achievements/pt.json';
import * as pt_BR from 'i18n/locales/achievements/pt_BR.json';
import * as ru from 'i18n/locales/achievements/ru.json';
import * as sl from 'i18n/locales/achievements/sl.json';
import * as sv from 'i18n/locales/achievements/sv.json';
import * as ta from 'i18n/locales/achievements/ta.json';
import * as tr_TR from 'i18n/locales/achievements/tr_TR.json';
import * as uk from 'i18n/locales/achievements/uk.json';
import * as vi from 'i18n/locales/achievements/vi.json';
import * as zh_CN from 'i18n/locales/achievements/zh_CN.json';
import * as zh_Hant from 'i18n/locales/achievements/zh_Hant.json';

import achievements from 'utils/data/achievements.json';

import { checkAchievements, newAchievements } from './condition';

const translations = {
  ar,
  arz,
  az,
  azb,
  bn,
  de_DE,
  el,
  en_GB,
  en_US,
  es,
  es_419,
  et,
  fa,
  fr,
  hu,
  id_ID,
  ja,
  lt,
  lv,
  nl,
  no,
  peo,
  pt,
  pt_BR,
  ru,
  sl,
  sv,
  ta,
  tr_TR,
  uk,
  vi,
  zh_CN,
  zh_Hant,
};

// todo: clean this up and condition.js too
function getLocalisedAchievementData(id) {
  const localised = translations[variables.languagecode][id] ||
    translations.en_GB[id] || { name: id, description: '' };

  return { name: localised.name, description: localised.description };
}

export { achievements, checkAchievements, newAchievements, getLocalisedAchievementData };
