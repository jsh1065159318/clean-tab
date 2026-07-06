import { achievements } from './index';

export function checkAchievements(stats) {
  const oldAchievements = JSON.parse(localStorage.getItem('achievements')) || [];
  const achievementTimestamps = JSON.parse(localStorage.getItem('achievementTimestamps')) || {};

  return achievements.map((achievement) => {
    let achieved = oldAchievements.includes(achievement.id);

    switch (achievement.condition.type) {
      case 'tabsOpened':
        if (stats['tabs-opened'] >= achievement.condition.amount) {
          achieved = true;
        }
        break;
      case 'addonInstall':
        if (stats.marketplace) {
          if (stats.marketplace['install'] >= achievement.condition.amount) {
            achieved = true;
          }
        }
        break;
      default:
        break;
    }

    return {
      ...achievement,
      achieved,
      timestamp: achievementTimestamps[achievement.id],
    };
  });
}

export function newAchievements(stats) {
  // calculate new achievements
  const oldAchievements = JSON.parse(localStorage.getItem('achievements')) || [];
  const achievementTimestamps = JSON.parse(localStorage.getItem('achievementTimestamps')) || {};
  const checkedAchievements = checkAchievements(stats);
  const newAchievements = [];

  checkedAchievements.forEach((achievement) => {
    if (achievement.achieved && !oldAchievements.includes(achievement.id)) {
      newAchievements.push(achievement);
    }
  });

  // add timestamp to new achievements
  const now = Date.now();
  newAchievements.forEach((achievement) => {
    achievement.timestamp = now;
    achievementTimestamps[achievement.id] = now;
  });

  // save new achievements and timestamps to local storage
  localStorage.setItem(
    'achievements',
    JSON.stringify([...oldAchievements, ...newAchievements.map((achievement) => achievement.id)]),
  );
  localStorage.setItem('achievementTimestamps', JSON.stringify(achievementTimestamps));

  return newAchievements;
}
