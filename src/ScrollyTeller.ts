import { EventEmitter } from "./EventEmitter";

export class ScrollyTeller {
    graphs: string[];
    anchorRoot: HTMLElement;
    graphicRoot: HTMLElement;
    scrollCover: HTMLElement;
    contentWell: HTMLElement;
    events: EventEmitter<any> = new EventEmitter();

    constructor(root: HTMLElement | string, graphs: string[], opts: any) {
        if (!root || !graphs) {
            throw new Error(`Class ScrollyTeller is missing required arguments. Please specify a root element and graphs of text.
                Given: {
                    root: ${root},
                    graphs: ${graphs}
                }`);
        }

        this.anchorRoot = (root && typeof root === 'string' ? <HTMLElement><any>document.querySelector(root) :
                          <HTMLElement>root);
        this.graphs = graphs;
        this.graphicRoot = this._createGraphicRoot(opts && opts.graphicRootStyles ? opts.graphicRootStyles : {});
        this.scrollCover = this._createScrollCover(opts && opts.scrollCoverStyles ? opts.scrollCoverStyles : {});
        this.contentWell = this._createContentWell(opts && opts.contentWellStyles ? opts.contentWellStyles: {},
                                                   opts && opts.graphMargin ? opts.graphMargin : "40vh");
        this.anchorRoot.appendChild(<Node><any>this.graphicRoot);
        this.scrollCover.appendChild(<Node><any>this.contentWell);
        this.anchorRoot.appendChild(<Node><any>this.scrollCover);
    }

    activate(color: string): ScrollyTeller {
        this.graphicRoot.style.backgroundColor = color || "#0e1d1d";
        this.events.emit({ event: "activated" });
        return this;
    }

    deactivate(color: string): ScrollyTeller {
        this.graphicRoot.style.backgroundColor = color || "inherit";
        this.events.emit({ event: "deactivated" });
        return this;
    }

    _createContentWell(customStyles: any, graphMargin: string): HTMLElement {
        const defaults = {
            "max-width": "700px",
            "width": "100vw"
        };
        const styles = (<any>Object).assign({}, defaults, customStyles);
        const contentWell = <HTMLElement><any>document.createElement("div");
        contentWell.style.cssText = this._styleObjToString(styles);
        for (let graph of this.graphs) {
            const idx = this.graphs.indexOf(graph);
            let p = <HTMLElement><any>document.createElement("p");
            p.style.marginTop = graphMargin;
            if (idx === this.graphs.length -1) p.style.marginBottom = graphMargin;
            p.innerText = graph;
            p.id = `scrolly-teller-graph-${idx}`;
            p.classList.add("scrolly-teller-graph");
            contentWell.appendChild(<Node><any>p);
        }
        return contentWell;
    }

    _createScrollCover(customStyles: any): HTMLElement {
        const defaults = {
            "width": "100vw",
            "z-index": "5"
        };
        const styles = (<any>Object).assign({}, defaults, customStyles);
        const scrollCover = <HTMLElement><any>document.createElement("div");
        scrollCover.style.cssText = this._styleObjToString(styles);
        return scrollCover;
    }

    _createGraphicRoot(customStyles: any): HTMLElement {
        const defaults = {
            "background-color": "inherit",
            "width": "100vw",
            "height": "100vh",
            "position": "fixed",
            "top": "0",
            "left": "0",
            "z-index": "-1",
            "-webkit-transition": "background-color 2s",
            "transition": "background-color 2s"
        };
        const styles = (<any>Object).assign({}, defaults, customStyles);
        const graphicRoot = <HTMLElement><any>document.createElement("div");
        graphicRoot.style.cssText = this._styleObjToString(styles);
        return graphicRoot;
    }

    _styleObjToString(styleObj: any): string {
        let str = "";
        for (let prop in styleObj) {
            if (styleObj.hasOwnProperty(prop)) {
                str += `${prop}: ${styleObj[prop]};`
            }
        }
        return str;
    }
}