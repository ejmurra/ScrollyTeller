import { EventEmitter } from "./EventEmitter";
export declare class ScrollyTeller {
    graphs: string[];
    anchorRoot: HTMLElement;
    graphicRoot: HTMLElement;
    scrollCover: HTMLElement;
    contentWell: HTMLElement;
    active: boolean;
    events: EventEmitter<any>;
    private _graphMargin;
    private ticking;
    private graphChildren;
    private graphicRootActiveStyles;
    private contentWellActiveStyles;
    private graphActiveStyles;
    private scrollCoverActiveStyles;
    private graphicRootDefaultStyles;
    private contentWellDefaultStyles;
    private graphDefaultStyles;
    private scrollCoverDefaultStyles;
    graphMargin: string;
    graphicRootStyles: {
        [prop: string]: string;
    };
    contentWellStyles: {
        [prop: string]: string;
    };
    graphStyles: {
        [prop: string]: string;
    };
    scrollCoverStyles: {
        [prop: string]: string;
    };
    constructor(root: HTMLElement | string, graphs: string[], opts?: {
        graphMargin?: string;
    });
    activate(color: string): ScrollyTeller;
    deactivate(color: string): ScrollyTeller;
    private scrollEmitterFunction();
    private scrollThrottler(position);
    private createContentWell();
    private createScrollCover();
    private createGraphicRoot();
    private styleObjToString(styleObj);
}
