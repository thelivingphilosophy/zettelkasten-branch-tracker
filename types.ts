import { TFile } from 'obsidian';

export interface ZettelNode {
    id: string;
    title: string;
    level: number;
    isCenter: boolean;
    position: { x: number; y: number };
    subnotesCount?: number;
    depthScore?: number;
}

export interface ZettelEdge {
    from: string;
    to: string;
    type: 'parent-child' | 'linear-continuation' | 'sequence-link';
}

export interface ZettelNetwork {
    nodes: Map<string, ZettelNode>;
    edges: ZettelEdge[];
}

export interface PluginSettings {
    showDepth: number;
    horizontalSpacing: number;
    verticalSpacing: number;
    maxBranches: number;
}

export interface MousePosition {
    x: number;
    y: number;
}

export interface PanOffset {
    x: number;
    y: number;
}