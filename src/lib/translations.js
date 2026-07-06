import zh_CN from 'translations/zh_CN.json';

const readNestedValue = (source, path) => {
  return path.split('.').reduce((value, segment) => value?.[segment], source);
};

const interpolate = (message, values = {}) => {
  if (typeof message !== 'string') {
    return message;
  }

  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    message,
  );
};

export function initTranslations() {
  return {
    getMessage(_locale, key, values) {
      return interpolate(readNestedValue(zh_CN, key) || key, values);
    },
  };
}

export const translations = {
  zh_CN,
};
