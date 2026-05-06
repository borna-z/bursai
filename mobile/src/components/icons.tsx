// Editorial icon set — 1.4–1.5 stroke-width SVG glyphs, 22×22 default size.
// Mirrors design_handoff_burs_rn/source/screens.jsx Icon.* exactly.
// Pass `color` to override stroke; `active` thickens stroke for nav highlighting.
//
// Default color is '#000' rather than 'currentColor' — RN-SVG doesn't resolve
// `currentColor` (it renders black on iOS, warns on Android), so the literal
// keeps the foot-gun off the table for any future caller that forgets to pass
// a theme token.

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconProps = {
  size?: number;
  color?: string;
  active?: boolean;
};

const sw = (active?: boolean) => (active ? 2 : 1.5);

export const HomeIcon = ({ size = 22, color = '#000', active }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.8Z"
      stroke={color}
      strokeWidth={sw(active)}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.18 : 0}
    />
  </Svg>
);

export const WardrobeIcon = ({ size = 22, color = '#000', active }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 8.5V11l9 6.5a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 17.5L12 11"
      stroke={color}
      strokeWidth={sw(active)}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.18 : 0}
    />
    <Path
      d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5"
      stroke={color}
      strokeWidth={sw(active)}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

export const PlanIcon = ({ size = 22, color = '#000', active }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={5} width={18} height={16} rx={2.5} stroke={color} strokeWidth={sw(active)} fill={active ? color : 'none'} fillOpacity={active ? 0.18 : 0} />
    <Path d="M3 10h18" stroke={color} strokeWidth={sw(active)} strokeLinecap="round" />
    <Path d="M8 3v4M16 3v4" stroke={color} strokeWidth={sw(active)} strokeLinecap="round" />
    <Circle cx={8} cy={14.5} r={1.1} fill={color} />
    <Circle cx={12} cy={14.5} r={1.1} fill={color} />
    <Circle cx={16} cy={14.5} r={1.1} fill={color} opacity={active ? 1 : 0.5} />
  </Svg>
);

export const InsightsIcon = ({ size = 22, color = '#000', active }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21h18" stroke={color} strokeWidth={sw(active)} strokeLinecap="round" />
    <Rect x={5} y={13} width={3.4} height={6} rx={0.8} stroke={color} strokeWidth={sw(active)} fill={active ? color : 'none'} fillOpacity={active ? 0.22 : 0} />
    <Rect x={10.3} y={9} width={3.4} height={10} rx={0.8} stroke={color} strokeWidth={sw(active)} fill={active ? color : 'none'} fillOpacity={active ? 0.22 : 0} />
    <Rect x={15.6} y={5} width={3.4} height={14} rx={0.8} stroke={color} strokeWidth={sw(active)} fill={active ? color : 'none'} fillOpacity={active ? 0.22 : 0} />
  </Svg>
);

export const PlusIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export const SearchIcon = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Circle cx={11} cy={11} r={7} />
    <Path d="m20 20-3.5-3.5" />
  </Svg>
);

export const FilterIcon = ({ size = 14, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Path d="M3 6h18M6 12h12M10 18h4" />
  </Svg>
);

export const ChevronIcon = ({ size = 14, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Path d="m9 6 6 6-6 6" />
  </Svg>
);

export const SunIcon = ({ size = 14, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Circle cx={12} cy={12} r={4} />
    <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Svg>
);

export const CameraIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <Circle cx={12} cy={13} r={3.5} />
  </Svg>
);

export const ImageIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={18} height={18} rx={2} />
    <Circle cx={9} cy={9} r={1.6} />
    <Path d="m21 15-5-5L5 21" />
  </Svg>
);

export const BackIcon = ({ size = 20, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

export const CloseIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const SparklesIcon = ({ size = 14, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <Path d="M19 17v4M17 19h4" />
  </Svg>
);

export const CalendarIcon = ({ size = 14, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Rect x={3} y={4} width={18} height={18} rx={2} />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

export const ChatIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </Svg>
);

export const OutfitsIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={8} height={8} rx={1.4} />
    <Rect x={13} y={3} width={8} height={8} rx={1.4} />
    <Rect x={3} y={13} width={8} height={8} rx={1.4} />
    <Path d="M14 17h7M14 14.5h7M14 19.5h5" />
  </Svg>
);

export const TshirtIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 3 4.5 5.5 6 9l2-1v12h8V8l2 1 1.5-3.5L16 3l-2 1.5a3 3 0 0 1-4 0L8 3Z" />
  </Svg>
);

export const SmileIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M8.5 14a4 4 0 0 0 7 0" />
    <Circle cx={9} cy={10} r={0.8} fill={color} />
    <Circle cx={15} cy={10} r={0.8} fill={color} />
  </Svg>
);

export const SuitcaseIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={7} width={18} height={13} rx={2} />
    <Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" />
  </Svg>
);

export const GapsIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={3} width={7} height={7} rx={1.2} />
    <Rect x={14} y={3} width={7} height={7} rx={1.2} />
    <Rect x={3} y={14} width={7} height={7} rx={1.2} />
    <Path d="M14 17.5h7M17.5 14v7" strokeDasharray="2 2" />
  </Svg>
);

export const GearIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const HangerIcon = ({ size = 20, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 8.5V11l9 6.5a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 17.5L12 11" />
    <Path d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5" />
  </Svg>
);

export const GridIcon = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
    <Rect x={3} y={3} width={7} height={7} rx={1.2} />
    <Rect x={14} y={3} width={7} height={7} rx={1.2} />
    <Rect x={3} y={14} width={7} height={7} rx={1.2} />
    <Rect x={14} y={14} width={7} height={7} rx={1.2} />
  </Svg>
);

export const ListIcon = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
    <Path d="M8 6h13M8 12h13M8 18h13" />
    <Circle cx={4} cy={6} r={1} fill={color} />
    <Circle cx={4} cy={12} r={1} fill={color} />
    <Circle cx={4} cy={18} r={1} fill={color} />
  </Svg>
);

export const EditIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Svg>
);

export const MoreIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={5} cy={12} r={1.6} fill={color} />
    <Circle cx={12} cy={12} r={1.6} fill={color} />
    <Circle cx={19} cy={12} r={1.6} fill={color} />
  </Svg>
);

export const ShareIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3v13" />
    <Path d="m7 8 5-5 5 5" />
    <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Svg>
);

export const StarIcon = ({ size = 22, color = '#000', active }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3 2.85 5.78L21 9.7l-4.5 4.39L17.62 21 12 18.04 6.38 21l1.12-6.91L3 9.7l6.15-.92L12 3z" />
  </Svg>
);

export const MinusIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M5 12h14" />
  </Svg>
);

export const CheckIcon = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m5 12 5 5L20 6" />
  </Svg>
);

export const BellIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

export const MailIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={4} width={20} height={16} rx={2} />
    <Path d="m2 7 10 7 10-7" />
  </Svg>
);

export const RotateIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <Path d="M21 3v5h-5" />
    <Path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <Path d="M3 21v-5h5" />
  </Svg>
);

export const FrameIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 6H2" />
    <Path d="M22 18H2" />
    <Path d="M6 2v20" />
    <Path d="M18 2v20" />
  </Svg>
);

export const LayersIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 2 9 5-9 5-9-5 9-5z" />
    <Path d="m3 12 9 5 9-5" />
    <Path d="m3 17 9 5 9-5" />
  </Svg>
);

export const UserOffIcon = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 21a8 8 0 0 0-12.5-6.5" />
    <Circle cx={10} cy={8} r={5} />
    <Path d="m20 16 4 4M24 16l-4 4" />
  </Svg>
);

export const SunRayIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={4} />
    <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Svg>
);

export const MoonIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

export const PhoneIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={5} y={2} width={14} height={20} rx={2.5} />
    <Path d="M11 18h2" />
  </Svg>
);

export const LockIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={4} y={11} width={16} height={10} rx={2} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const GlobeIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M3 12h18" />
    <Path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
  </Svg>
);

export const ShieldIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
  </Svg>
);

export const TrashIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <Path d="M19 6 18 21a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </Svg>
);

export const FileIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
  </Svg>
);

export const KeyIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={8} cy={15} r={4} />
    <Path d="m11 12 9-9 3 3-3 3 2 2-3 3-2-2-3 3z" />
  </Svg>
);

export const PaletteIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22a9 9 0 1 1 9-9 4 4 0 0 1-4 4h-2a2 2 0 0 0-1 4 1.5 1.5 0 0 1-2 1z" />
    <Circle cx={7.5} cy={10.5} r={0.8} fill={color} />
    <Circle cx={12} cy={7} r={0.8} fill={color} />
    <Circle cx={16.5} cy={10.5} r={0.8} fill={color} />
  </Svg>
);

export const PlaneIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </Svg>
);
