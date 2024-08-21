import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  CrashData,
  Crashes,
  MicStatus,
  Pages,
  RecStatus,
  SaveStatus,
  AppState,
  UpgradeStatus,
  RendererVideo,
} from 'main/types';
import Box from '@mui/material/Box';
import { ArrowBigDownDash } from 'lucide-react';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import './App.css';
import { useSettings } from './useSettings';
import { getCategoryFromConfig } from './rendererutils';
import StateManager from './StateManager';
import { TooltipProvider } from './components/Tooltip/Tooltip';
import Toaster from './components/Toast/Toaster';
import { toast } from './components/Toast/useToast';
import { ToastAction } from './components/Toast/Toast';

const ipc = window.electron.ipcRenderer;

const WarcraftRecorder = () => {
  const [config] = useSettings();
  const [error, setError] = useState<string>('');
  const [micStatus, setMicStatus] = useState<MicStatus>(MicStatus.NONE);
  const [crashes, setCrashes] = useState<Crashes>([]);
  const upgradeNotified = useRef(false);

  // The video state contains most of the frontend state, it's complex so
  // frontend triggered modifications go through the StateManager class, which
  // calls the React set function appropriately.
  const [videoState, setVideoState] = useState<RendererVideo[]>([]);

  const stateManager = useRef<StateManager>(
    StateManager.getInstance(setVideoState)
  );

  const [recorderStatus, setRecorderStatus] = useState<RecStatus>(
    RecStatus.WaitingForWoW
  );

  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus>({
    available: false,
    link: undefined,
  });

  useEffect(() => {
    if (upgradeNotified.current) return;

    if (upgradeStatus.available) {
      toast({
        title: 'Update available!',
        description:
          'There is an update available for Warcraft Recorder. Please click the button below to download it.',
        action: (
          <a href={upgradeStatus.link} className="w-full">
            <ToastAction altText="Download">
              <ArrowBigDownDash /> Download
            </ToastAction>
          </a>
        ),
        duration: 60000, // stay up for a minute I guess
      });
      upgradeNotified.current = true;
    }
  }, [upgradeStatus, upgradeNotified]);

  const [savingStatus, setSavingStatus] = useState<SaveStatus>(
    SaveStatus.NotSaving
  );

  const [appState, setAppState] = useState<AppState>({
    // Navigation.
    page: Pages.None,
    category: getCategoryFromConfig(config),
    playingVideo: undefined,
    selectedVideoName: undefined,

    // Limit the number of videos displayed for performance. User can load more
    // by clicking the button, but mainline case will be to watch back recent
    // videos.
    numVideosDisplayed: 10,

    // Any text applied in the filter bar gets translated into a filter here.
    videoFilterQuery: '',

    // We use this to conditionally hide the recording preview.
    videoFullScreen: false,
  });

  // Used to allow for hot switching of video players when moving between POVs.
  const persistentProgress = useRef(0);

  // Used to remember the player height when switching categories.
  const playerHeight = useRef(500);

  const doRefresh = async () => {
    stateManager.current.refresh();

    setAppState((prevState) => {
      return {
        ...prevState,
        // Fixes issue 410 which caused the preview not to re-appear if
        // refreshState triggered when full screen.
        videoFullScreen: false,
      };
    });
  };

  const updateRecStatus = (status: unknown, err: unknown) => {
    setRecorderStatus(status as RecStatus);

    if (status === RecStatus.InvalidConfig || status === RecStatus.FatalError) {
      setError(err as string);
    }
  };

  const updateSaveStatus = (status: unknown) => {
    setSavingStatus(status as SaveStatus);
  };

  const updateUpgradeStatus = (available: unknown, link: unknown) => {
    setUpgradeStatus({
      available: available as boolean,
      link: link as string,
    });
  };

  const updateMicStatus = (status: unknown) => {
    setMicStatus(status as MicStatus);
  };

  const updateCrashes = (crash: unknown) => {
    setCrashes((prevArray) => [...prevArray, crash as CrashData]);
  };

  useEffect(() => {
    doRefresh();
    ipc.on('refreshState', doRefresh);
    ipc.on('updateRecStatus', updateRecStatus);
    ipc.on('updateSaveStatus', updateSaveStatus);
    ipc.on('updateUpgradeStatus', updateUpgradeStatus);
    ipc.on('updateMicStatus', updateMicStatus);
    ipc.on('updateCrashes', updateCrashes);
  }, []);

  return (
    <Box
      id="main-box"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      <Toaster />
      <TooltipProvider>
        <RendererTitleBar />
        <Layout
          recorderStatus={recorderStatus}
          stateManager={stateManager}
          videoState={videoState}
          appState={appState}
          setAppState={setAppState}
          persistentProgress={persistentProgress}
          playerHeight={playerHeight}
          error={error}
          micStatus={micStatus}
          crashes={crashes}
          upgradeStatus={upgradeStatus}
          savingStatus={savingStatus}
        />
      </TooltipProvider>
    </Box>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WarcraftRecorder />} />
      </Routes>
    </Router>
  );
}
