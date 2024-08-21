/**
 * Please keep this file FREE from filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import {
  dungeonEncounters,
  dungeonsByMapId,
  instanceDifficulty,
  instanceEncountersById,
  months,
  specializationById,
  WoWCharacterClassType,
  WoWClassColor,
} from 'main/constants';
import { TimelineSegmentType } from 'main/keystone';
import {
  MarkerColors,
  DeathMarkers,
  Encoder,
  EncoderType,
  IOBSDevice,
  PlayerDeathType,
  RawChallengeModeTimelineSegment,
  RendererVideo,
  SoloShuffleTimelineSegment,
  VideoMarker,
} from 'main/types';
import { ambiguate } from 'parsing/logutils';
import { VideoCategory } from 'types/VideoCategory';
import { ESupportedEncoders } from 'main/obsEnums';
import { PTTEventType, PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import { ConfigurationSchema } from 'main/configSchema';

const getVideoResult = (video: RendererVideo): boolean => {
  return video.result;
};

/**
 * Returns a string of the form MM:SS.
 */
const getFormattedDuration = (video: RendererVideo) => {
  const { duration } = video;

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);

  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  if (hours > 0) {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Return an array of death markers for a video.
 * @param video the RendereVideo data type for the video
 */
const getOwnDeathMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];
  const { player } = video;

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const [name] = ambiguate(death.name);
    const markerText = `Death (${name})`;
    let color: string;

    if (death.friendly) {
      color = MarkerColors.LOSS;
    } else {
      color = MarkerColors.WIN;
    }

    if (!player || !player._name) {
      return;
    }

    if (player._name === name) {
      videoMarkers.push({
        time: death.timestamp,
        text: markerText,
        color,
        duration: 5,
      });
    }
  });

  return videoMarkers;
};

/**
 * Return an array of death markers for a video.
 * @param video the RendereVideo data type for the video
 * @param ownOnly true if should only get the players deaths
 */
const getAllDeathMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const [name] = ambiguate(death.name);
    const markerText = `Death (${name})`;
    let color: string;

    if (death.friendly) {
      color = MarkerColors.LOSS;
    } else {
      color = MarkerColors.WIN;
    }

    videoMarkers.push({
      time: death.timestamp,
      text: markerText,
      color,
      duration: 5,
    });
  });

  return videoMarkers;
};

/**
 * Return an array of markers for a solo shuffle. This is markers for each
 * round, colored green for wins or red for losses.
 */
const getRoundMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.soloShuffleTimeline === undefined) {
    return videoMarkers;
  }

  video.soloShuffleTimeline.forEach((segment: SoloShuffleTimelineSegment) => {
    let markerText = `Round ${segment.round}`;
    let color: string;

    if (segment.result) {
      markerText = `${markerText} (Win)`;
      color = MarkerColors.WIN;
    } else {
      markerText = `${markerText} (Loss)`;
      color = MarkerColors.LOSS;
    }

    // Older solo shuffle segments don't have a duration.
    const duration = segment.duration ? segment.duration : 5;

    videoMarkers.push({
      time: segment.timestamp,
      text: markerText,
      color,
      duration,
    });
  });

  return videoMarkers;
};

/**
 * Return an array of markers for a challenge mode, this highlights the boss
 * encounters as orange and the trash as purple.
 */
const getEncounterMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.challengeModeTimeline === undefined) {
    return videoMarkers;
  }

  video.challengeModeTimeline.forEach(
    (segment: RawChallengeModeTimelineSegment) => {
      if (
        segment.logEnd === undefined ||
        segment.logStart === undefined ||
        segment.segmentType === undefined ||
        segment.segmentType !== TimelineSegmentType.BossEncounter ||
        segment.timestamp === undefined
      ) {
        return;
      }

      const segmentEnd = new Date(segment.logEnd);
      const segmentStart = new Date(segment.logStart);

      const segmentDuration = Math.floor(
        (segmentEnd.getTime() - segmentStart.getTime()) / 1000
      );

      let markerText = '';

      if (segment.encounterId !== undefined) {
        markerText = dungeonEncounters[segment.encounterId];
      }

      videoMarkers.push({
        time: segment.timestamp,
        text: markerText,
        color: MarkerColors.ENCOUNTER,
        duration: segmentDuration,
      });
    }
  );

  return videoMarkers;
};

const getWoWClassColor = (unitClass: WoWCharacterClassType) => {
  return WoWClassColor[unitClass];
};

const getInstanceDifficultyText = (video: RendererVideo) => {
  const { difficultyID } = video;

  if (difficultyID === undefined) {
    return '';
  }

  const knownDifficulty = Object.prototype.hasOwnProperty.call(
    instanceDifficulty,
    difficultyID
  );

  if (!knownDifficulty) {
    return '';
  }

  const difficulty = instanceDifficulty[difficultyID].difficultyID;
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
};

/**
 * Get the name of a boss encounter based on its encounter ID. Ideally we
 * would just write this to the metadata and not have to re-calulate on the
 * frontend.
 */
const getEncounterNameById = (encounterId: number): string => {
  const recognisedEncounter = Object.prototype.hasOwnProperty.call(
    instanceEncountersById,
    encounterId
  );

  if (recognisedEncounter) {
    return instanceEncountersById[encounterId];
  }

  return 'Unknown Boss';
};

/**
 * Get the dungeon name if possible, else an empty string.
 */
const getDungeonName = (video: RendererVideo) => {
  const { mapID } = video;

  if (mapID !== undefined) {
    return dungeonsByMapId[mapID];
  }

  return '';
};

const isMythicPlusUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.MythicPlus ||
    parentCategory === VideoCategory.MythicPlus
  );
};

const isRaidUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.Raids || parentCategory === VideoCategory.Raids
  );
};

const isBattlegroundUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.Battlegrounds ||
    parentCategory === VideoCategory.Battlegrounds
  );
};

const isSoloShuffleUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.SoloShuffle ||
    parentCategory === VideoCategory.SoloShuffle
  );
};

const isArenaUtil = (video: RendererVideo) => {
  return (
    !isMythicPlusUtil(video) && !isRaidUtil(video) && !isBattlegroundUtil(video)
  );
};

const isClip = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.Clips;
};

const getResultColor = (video: RendererVideo) => {
  const { result, soloShuffleRoundsWon, upgradeLevel } = video;

  if (isSoloShuffleUtil(video)) {
    if (
      soloShuffleRoundsWon !== undefined &&
      soloShuffleRoundsWon >= 0 &&
      soloShuffleRoundsWon <= 6
    ) {
      // This is linear gradient from red to green, in RBG format as I don't know
      // a better way to pass it through. Generated with: https://cssgradient.io/.
      // The key is the number of wins.
      const soloShuffleResultColors = [
        'rgb(53,  164, 50, 0.3)',
        'rgb(46,  171, 27, 0.3)',
        'rgb(112, 170, 30, 0.3)',
        'rgb(171, 150, 30, 0.3)',
        'rgb(171, 86,  26, 0.3)',
        'rgb(175, 50,  23, 0.3)',
        'rgb(156, 21,  21, 0.3)',
      ].reverse();

      return soloShuffleResultColors[soloShuffleRoundsWon];
    }
  }

  if (
    isMythicPlusUtil(video) &&
    result &&
    upgradeLevel !== undefined &&
    upgradeLevel < 1
  ) {
    // It's a completed, but depleted mythic+.
    return 'hsl(var(--warning))';
  }

  if (result) {
    return 'hsl(var(--success))';
  }

  return 'hsl(var(--error))';
};

const getPlayerName = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player._name === undefined) {
    return '';
  }

  return player._name;
};

const getPlayerRealm = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player._realm === undefined) {
    return '';
  }

  return player._realm;
};

const getPlayerSpecID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._specID === undefined) {
    return 0;
  }

  const knownSpec = Object.prototype.hasOwnProperty.call(
    specializationById,
    player._specID
  );

  if (!knownSpec) {
    return 0;
  }

  return player._specID;
};

const getPlayerTeamID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._teamID === undefined) {
    return 0;
  }

  return player._teamID;
};

const getPlayerClass = (video: RendererVideo): WoWCharacterClassType => {
  const { player } = video;

  if (player === undefined) {
    return 'UNKNOWN';
  }

  if (player._specID === undefined) {
    return 'UNKNOWN';
  }

  if (specializationById[player._specID] === undefined) {
    return 'UNKNOWN';
  }

  return specializationById[player._specID].class;
};

const getVideoTime = (video: RendererVideo) => {
  const { start, mtime } = video;
  const date = start ? new Date(start) : new Date(mtime);

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;
  return timeAsString;
};

const getVideoDate = (video: RendererVideo) => {
  const date = video.start ? new Date(video.start) : new Date(video.mtime);
  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;
  return dateAsString;
};

/**
 * Get the human readable description of a device from its id. Returns
 * unknown if not an available device.
 *
 * @param id the device id
 * @param availableAudioDevices list of available sources from OBS
 */
const getAudioDeviceDescription = (
  id: string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
) => {
  let result = 'Unknown';

  availableAudioDevices.input.forEach((device) => {
    if (device.id === id) {
      result = device.description;
    }
  });

  availableAudioDevices.output.forEach((device) => {
    if (device.id === id) {
      result = device.description;
    }
  });

  return result;
};

/**
 * Check if an id represents an available audio device.
 *
 * @param id the device id
 * @param availableAudioDevices list of available sources from OBS
 */
const isKnownAudioDevice = (
  id: string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
) => {
  if (getAudioDeviceDescription(id, availableAudioDevices) === 'Unknown') {
    return false;
  }

  return true;
};

/**
 * Standardizes device names to an array of strings and filters by known devices.
 *
 * @param deviceNames the device names to standardize
 * @param availableAudioDevices list of available sources from OBS
 * @returns the standardized device names
 */
const standardizeAudioDeviceNames = (
  deviceNames: string[] | string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
): string[] => {
  let normalizedDeviceNames: string[];

  if (typeof deviceNames === 'string') {
    normalizedDeviceNames = deviceNames.split(',');
  } else {
    normalizedDeviceNames = deviceNames;
  }

  return normalizedDeviceNames.filter((id) =>
    isKnownAudioDevice(id, availableAudioDevices)
  );
};

const isHighRes = (res: string) => {
  const resolutions = res.split('x');
  const [width, height] = resolutions;

  if (parseInt(width, 10) >= 4000 || parseInt(height, 10) >= 4000) {
    return true;
  }

  return false;
};

const encoderFilter = (enc: string, highRes: boolean) => {
  const encoder = enc as ESupportedEncoders;

  if (!Object.values(ESupportedEncoders).includes(encoder)) {
    return false;
  }

  // If we have a resolution above 4k, only the software encoder is valid.
  if (highRes) {
    return encoder === ESupportedEncoders.OBS_X264;
  }

  return true;
};

const mapEncoderToString = (enc: Encoder) => {
  return `${enc.type} (${enc.name})`;
};

const mapStringToEncoder = (enc: string): Encoder => {
  const encoder = enc as ESupportedEncoders;
  const isHardwareEncoder = encoder !== ESupportedEncoders.OBS_X264;

  const encoderType = isHardwareEncoder
    ? EncoderType.HARDWARE
    : EncoderType.SOFTWARE;

  return { name: enc, type: encoderType };
};

const pathSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectPath', []);
  return path;
};

const fileSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectFile', []);
  return path;
};

const convertNumToDeathMarkers = (n: number) => {
  if (n === 2) return DeathMarkers.ALL;
  if (n === 1) return DeathMarkers.OWN;
  return DeathMarkers.NONE;
};

const convertDeathMarkersToNum = (d: DeathMarkers) => {
  if (d === DeathMarkers.ALL) return 2;
  if (d === DeathMarkers.OWN) return 1;
  return 0;
};

const getPTTKeyPressEventFromConfig = (
  config: ConfigurationSchema
): PTTKeyPressEvent => {
  const ctrl = config.pushToTalkModifiers.includes('ctrl');
  const win = config.pushToTalkModifiers.includes('win');
  const shift = config.pushToTalkModifiers.includes('shift');
  const alt = config.pushToTalkModifiers.includes('alt');

  const type =
    config.pushToTalkKey > 0
      ? PTTEventType.EVENT_KEY_PRESSED
      : PTTEventType.EVENT_MOUSE_PRESSED;

  return {
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: win,
    shiftKey: shift,
    keyCode: config.pushToTalkKey,
    mouseButton: config.pushToTalkMouseButton,
    type,
  };
};

const getKeyByValue = (object: any, value: any) => {
  return Object.keys(object).find((key) => object[key] === value);
};

const getKeyModifiersString = (keyevent: PTTKeyPressEvent) => {
  const modifiers: string[] = [];

  if (keyevent.altKey) {
    modifiers.push('alt');
  }
  if (keyevent.ctrlKey) {
    modifiers.push('ctrl');
  }
  if (keyevent.shiftKey) {
    modifiers.push('shift');
  }
  if (keyevent.metaKey) {
    modifiers.push('win');
  }

  return modifiers.join(',');
};

const blurAll = (document: Document) => {
  const tmp = document.createElement('input');
  document.body.appendChild(tmp);
  tmp.focus();
  document.body.removeChild(tmp);
};

const getNextKeyOrMouseEvent = async (): Promise<PTTKeyPressEvent> => {
  const ipc = window.electron.ipcRenderer;
  return ipc.invoke('getNextKeyPress', []);
};

const secToMmSs = (s: number) => {
  const rounded = Math.round(s);
  const mins = Math.floor(rounded / 60);
  const secs = rounded - mins * 60;

  const ss = secs.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  const mm = mins.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  return `${mm}:${ss}`;
};

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort.
 */
const getVideoResultText = (video: RendererVideo): string => {
  const {
    result,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed,
  } = video;

  if (isMythicPlusUtil(video)) {
    if (!result) {
      return 'Abandoned';
    }

    if (upgradeLevel === undefined) {
      return '';
    }

    if (upgradeLevel < 1) {
      return 'Depleted';
    }

    return String(upgradeLevel);
  }

  if (isRaidUtil(video)) {
    return result ? 'Kill' : 'Wipe';
  }

  if (isSoloShuffleUtil(video)) {
    if (
      soloShuffleRoundsWon === undefined ||
      soloShuffleRoundsPlayed === undefined
    ) {
      return '';
    }

    const wins = soloShuffleRoundsWon;
    const losses = soloShuffleRoundsPlayed - soloShuffleRoundsWon;
    return `${wins} - ${losses}`;
  }

  return result ? 'Win' : 'Loss';
};

const getCategoryFromConfig = (config: ConfigurationSchema) => {
  const categories = Object.values(VideoCategory);
  return categories[config.selectedCategory];
};

const getCategoryIndex = (category: VideoCategory) => {
  const categories = Object.values(VideoCategory);
  return categories.indexOf(category);
};

const getVideoCategoryFilter = (category: VideoCategory) => {
  return (video: RendererVideo) => video.category === category;
};

const getFirstInCategory = (
  videos: RendererVideo[],
  category: VideoCategory
) => {
  return videos.find((video) => video.category === category);
};

/**
 * Stop an event propogating higher.
 */
const stopPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.stopPropagation();
  event.preventDefault();
};

const povNameSort = (a: RendererVideo, b: RendererVideo) => {
  const playerA = a.player?._name;
  const playerB = b.player?._name;
  if (!playerA || !playerB) return 0;
  return playerA.localeCompare(playerB);
};

const areDatesWithinSeconds = (d1: Date, d2: Date, sec: number) => {
  const differenceMilliseconds = Math.abs(d1.getTime() - d2.getTime());
  const millisecondsInMinute = sec * 1000; // 60 seconds * 1000 milliseconds
  return differenceMilliseconds <= millisecondsInMinute;
};

const countUniquePovs = (povs: RendererVideo[]) => {
  let uniquePovs = 0;
  const seenPovs: string[] = [];

  for (let i = 0; i < povs.length; i++) {
    const name = povs[i].player?._name;

    if (name && !seenPovs.includes(name)) {
      uniquePovs++;
      seenPovs.push(name);
    }
  }

  return uniquePovs;
};

const toFixedDigits = (n: number, d: number) =>
  n.toLocaleString('en-US', { minimumIntegerDigits: d, useGrouping: false });

export {
  getFormattedDuration,
  getVideoResult,
  getWoWClassColor,
  getVideoResultText,
  getInstanceDifficultyText,
  getEncounterNameById,
  getDungeonName,
  isMythicPlusUtil,
  isRaidUtil,
  isBattlegroundUtil,
  isSoloShuffleUtil,
  isArenaUtil,
  isClip,
  getResultColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  getPlayerTeamID,
  getPlayerClass,
  getVideoTime,
  getVideoDate,
  getAudioDeviceDescription,
  isKnownAudioDevice,
  standardizeAudioDeviceNames,
  encoderFilter,
  mapEncoderToString,
  mapStringToEncoder,
  pathSelect,
  fileSelect,
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
  getAllDeathMarkers,
  getOwnDeathMarkers,
  getRoundMarkers,
  getEncounterMarkers,
  isHighRes,
  getPTTKeyPressEventFromConfig,
  getKeyByValue,
  blurAll,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  secToMmSs,
  getCategoryFromConfig,
  getVideoCategoryFilter,
  getCategoryIndex,
  getFirstInCategory,
  stopPropagation,
  povNameSort,
  areDatesWithinSeconds,
  countUniquePovs,
  toFixedDigits,
};
