import {
  Terminal, Server, Database, Globe, Code, FileText, Settings, Zap,
  Box, Layers, Cpu, Network, Shield, Key,
  GitBranch, Package, Rocket, Bug, Wrench, Eye, Clock,
  Folder, File, Activity, BarChart, Cloud, Lock, Play,
  Monitor, Wifi, Power, RefreshCw, Check, Search, Home,
  Hash, Tag, Circle, Info, AlertTriangle, Cog, Radio,
  HardDrive, SquareTerminal, Workflow, Braces, Binary,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Terminal, Server, Database, Globe, Code, FileText, Settings, Zap,
  Box, Layers, Cpu, Network, Shield, Key,
  GitBranch, Package, Rocket, Bug, Wrench, Eye, Clock,
  Folder, File, Activity, BarChart, Cloud, Lock, Play,
  Monitor, Wifi, Power, RefreshCw, Check, Search, Home,
  Hash, Tag, Circle, Info, AlertTriangle, Cog, Radio,
  HardDrive, SquareTerminal, Workflow, Braces, Binary,
};

export function resolveIcon(name?: string): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_MAP[name];
}
