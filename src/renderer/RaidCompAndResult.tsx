import { Box } from '@mui/material';
import React from 'react';
import { RawCombatant, RendererVideo } from 'main/types';
import { specializationById } from 'main/constants';
import { areDatesWithinSeconds, getVideoResultText } from './rendererutils';
import * as Images from './images';
import DeathIcon from '../../assets/icon/death.png';

interface IProps {
  video: RendererVideo;
  raidCategoryState: RendererVideo[];
}

type RoleCount = {
  tank: number;
  healer: number;
  damage: number;
};

const RaidCompAndResult: React.FC<IProps> = (props: IProps) => {
  const { video, raidCategoryState } = props;
  const { combatants, deaths } = video;
  const resultText = getVideoResultText(video);
  const deathCount = deaths ? deaths.length : 0;

  const roleCount: RoleCount = {
    tank: 0,
    healer: 0,
    damage: 0,
  };

  combatants.forEach((combant: RawCombatant) => {
    const specID = combant._specID;

    if (specID === undefined) {
      return;
    }

    const spec = specializationById[specID];

    if (spec === undefined) {
      return;
    }

    const { role } = spec;
    roleCount[role]++;
  });

  const getPullNumber = () => {
    const videoDate = video.start
      ? new Date(video.start)
      : new Date(video.mtime);

    const dailyVideosInOrder: RendererVideo[] = [];

    raidCategoryState.forEach((neighbourVideo) => {
      const bestDate = neighbourVideo.start
        ? neighbourVideo.start
        : neighbourVideo.mtime;

      const neighbourDate = new Date(bestDate);

      // Pulls longer than 3 hours apart are considered
      // from different sessions and will reset the pull
      // counter.
      const withinThreshold = areDatesWithinSeconds(
        videoDate,
        neighbourDate,
        3600 * 3
      );

      if (
        video.encounterID === undefined ||
        neighbourVideo.encounterID === undefined
      ) {
        return;
      }

      const sameEncounter = video.encounterID === neighbourVideo.encounterID;

      if (
        video.difficultyID === undefined ||
        neighbourVideo.difficultyID === undefined
      ) {
        return;
      }

      const sameDifficulty = video.difficultyID === neighbourVideo.difficultyID;

      if (withinThreshold && sameEncounter && sameDifficulty) {
        dailyVideosInOrder.push(neighbourVideo);
      }
    });

    dailyVideosInOrder.sort((A: RendererVideo, B: RendererVideo) => {
      const bestTimeA = A.start ? A.start : A.mtime;
      const bestTimeB = B.start ? B.start : B.mtime;
      return bestTimeA - bestTimeB;
    });

    return dailyVideosInOrder.indexOf(video) + 1;
  };

  const renderCounter = (role: string) => {
    return (
      <Box
        key={`parent-${role}`}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          p: '4px',
        }}
      >
        <Box
          key={`child-${role}`}
          component="img"
          src={Images.roleImages[role]}
          sx={{
            height: '20px',
            width: '20px',
            objectFit: 'cover',
          }}
        />
        <span className="text-white font-semibold text-xs text-shadow-instance ml-1">
          {roleCount[role as keyof RoleCount]}
        </span>
      </Box>
    );
  };

  const renderRaidComp = () => {
    if (combatants.length < 1) {
      return <></>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {Object.keys(roleCount).map(renderCounter)}
      </Box>
    );
  };

  const renderResult = () => {
    return (
      <Box
        sx={{
          mx: '2px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="text-white font-semibold text-xs text-shadow-instance">
          {`${resultText} (Pull ${getPullNumber()})`}
        </span>
      </Box>
    );
  };

  const renderDeaths = () => {
    return (
      <Box
        sx={{
          mx: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="text-white font-semibold text-xs text-shadow-instance">
          {deathCount}
        </span>
        <Box
          key="death-icon"
          component="img"
          src={DeathIcon}
          sx={{
            p: '2px',
            height: '16px',
            width: '16px',
            objectFit: 'cover',
          }}
        />
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderDeaths()}
      {renderRaidComp()}
      {renderResult()}
    </Box>
  );
};

export default RaidCompAndResult;
