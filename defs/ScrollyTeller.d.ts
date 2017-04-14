export interface Event {
    state: any;
    scrollDirection: "down" | "up";
    graphState?: "entered" | "exited";
    setState: (state: any) => void;
}
export declare class ScrollyTeller {
    graphs: string[];
    anchorRoot: HTMLElement;
    graphicRoot: HTMLElement;
    scrollCover: HTMLElement;
    contentWell: HTMLElement;
    active: boolean;
    topSpacer: HTMLElement;
    bottomSpacer: HTMLElement;
    private state;
    private _subscriptions;
    private ticking;
    private lastScroll;
    private _graphMargin;
    private graphChildren;
    private topInView;
    private botInView;
    private graphicRootActiveStyles;
    private contentWellActiveStyles;
    private graphActiveStyles;
    private scrollCoverActiveStyles;
    private graphicRootDefaultStyles;
    private contentWellDefaultStyles;
    private graphDefaultStyles;
    private scrollCoverDefaultStyles;
    subscriptions: any;
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
    constructor(root: HTMLElement | string, graphs: string[]);
    private activate(direction);
    private deactivate(direction);
    private scrollHandler();
    private setState(newState);
    private createContentWell();
    private createScrollCover();
    private createGraphicRoot();
    private styleObjToString(styleObj);
}
