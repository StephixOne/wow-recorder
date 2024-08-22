import React, { useState } from 'react';
import { OurDisplayType, WindowCaptureChoice } from 'main/types';
import { configSchema } from 'main/configSchema';
import { Info } from 'lucide-react';
import { useSettings, setConfigValues } from './useSettings';
import Label from './components/Label/Label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

const VideoSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const [displays, setDisplays] = useState<OurDisplayType[]>([]);
  const [windows, setWindows] = useState<WindowCaptureChoice[]>([]);
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    const getDisplays = async () => {
      const allDisplays = await ipc.invoke('getAllDisplays', []);
      setDisplays(allDisplays);
    };

    getDisplays();

    const getWindows = async () => {
      const allWindows = await ipc.invoke('getWindows', []);
      setWindows(allWindows);
    };

    getWindows();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsCaptureMode: config.obsCaptureMode,
      obsWindowName: config.obsWindowName,
      monitorIndex: config.monitorIndex,
      captureCursor: config.captureCursor,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.monitorIndex,
    config.obsCaptureMode,
    config.captureCursor,
    config.obsWindowName,
  ]);

  const setOBSCaptureMode = (mode: string) => {
    if (mode === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        obsCaptureMode: mode,
      };
    });
  };

  const setOBSWindowName = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsWindowName: value,
      };
    });
  };

  const setMonitor = (display: string) => {
    if (display === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        monitorIndex: parseInt(display, 10),
      };
    });
  };

  const setCaptureCursor = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        captureCursor: checked,
      };
    });
  };

  const getCaptureModeToggle = () => {
    return (
      <div>
        <Label className="flex items-center">
          Capture Mode
          <Tooltip content={configSchema.obsCaptureMode.description}>
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <ToggleGroup
          value={config.obsCaptureMode}
          onValueChange={setOBSCaptureMode}
          size="sm"
          type="single"
          variant="outline"
        >
          <ToggleGroupItem value="window_capture">Window</ToggleGroupItem>
          <ToggleGroupItem value="game_capture">Game</ToggleGroupItem>
          <ToggleGroupItem value="monitor_capture">Monitor</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const getMonitorToggle = () => {
    if (config.obsCaptureMode !== 'monitor_capture') {
      return <></>;
    }

    return (
      <div>
        <Label className="flex items-center">
          Monitor #
          <Tooltip content={configSchema.monitorIndex.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <ToggleGroup
          value={config.monitorIndex.toString()}
          onValueChange={setMonitor}
          type="single"
          variant="outline"
          size="sm"
        >
          {displays.map((display: OurDisplayType) => (
            <ToggleGroupItem value={display.index.toString()}>
              {display.index + 1}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };

  const getWindowSelect = () => {
    if (config.obsCaptureMode !== 'window_capture') {
      return <></>;
    }

    // Always include the base game modes even if they aren't currently running.
    const classicOpen = windows.find(
      (window) => window.name === '[WowClassic.exe]: World of Warcraft'
    );

    const retailOpen = windows.find(
      (window) => window.name === '[Wow.exe]: World of Warcraft'
    );

    if (!classicOpen) {
      windows.push({
        name: '[WowClassic.exe]: World of Warcraft',
        value: 'World of Warcraft:GxWindowClass:Window:Wow.exe',
      });
    }

    if (!retailOpen) {
      windows.push({
        name: '[Wow.exe]: World of Warcraft',
        value: 'World of Warcraft:waApplication Window:Wow.exe',
      });
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          Window
          <Tooltip content={configSchema.obsWindowName.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select value={config.obsWindowName} onValueChange={setOBSWindowName}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a window" />
          </SelectTrigger>
          <SelectContent>
            {windows.map((window) => (
              <SelectItem key={window.value} value={window.value}>
                {window.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const getCursorToggle = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          Capture Cursor
          <Tooltip content={configSchema.captureCursor.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.captureCursor}
            onCheckedChange={setCaptureCursor}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center w-full gap-x-8">
      {getCaptureModeToggle()}
      {getMonitorToggle()}
      {getWindowSelect()}
      {getCursorToggle()}
    </div>
  );
};

export default VideoSourceControls;
