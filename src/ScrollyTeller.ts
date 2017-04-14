import { EventEmitter } from "./EventEmitter";

export class ScrollyTeller {
  graphs: string[];
  anchorRoot: HTMLElement;
  graphicRoot: HTMLElement;
  scrollCover: HTMLElement;
  contentWell: HTMLElement;
  active: boolean = false;
  events: EventEmitter<any> = new EventEmitter();
  topSpacer: HTMLElement;
  bottomSpacer: HTMLElement;
  private lastScroll = 0;
  private _graphMargin: string;
  private ticking = false;
  private graphChildren: HTMLElement[];
  private topInView = false;
  private botInView = false;

  private graphicRootActiveStyles: { [prop: string]: string };
  private contentWellActiveStyles: { [prop: string]: string };
  private graphActiveStyles: { [prop: string]: string };
  private scrollCoverActiveStyles: { [prop: string]: string };

  private graphicRootDefaultStyles = {
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

  private contentWellDefaultStyles = {
    "max-width": "700px",
    "width": "100vw"
  };

  private graphDefaultStyles = {};

  private scrollCoverDefaultStyles = {
    "width": "100vw",
    "z-index": "5"
  };

  get graphMargin() {
    return this._graphMargin || "40vh";
  }

  set graphMargin(margin: string) {
    this._graphMargin = margin;
    for (let childEl of this.graphChildren) {
      const margins = {
        "margin-top": this._graphMargin,
        "margin-bottom": this.graphChildren.indexOf(
          childEl) === this.graphChildren.length - 1 ? this._graphMargin : "inherit"
      };
      childEl.style.cssText = this.styleObjToString(Object.assign({}, this.graphActiveStyles, margins))
    }
  }

  set graphicRootStyles(styles: { [prop: string]: string }) {
    this.graphicRootActiveStyles = Object.assign({}, this.graphicRootDefaultStyles, this.graphicRootActiveStyles,
      styles);
    this.graphicRoot.style.cssText = this.styleObjToString(this.graphicRootActiveStyles);
  }

  set contentWellStyles(styles: { [prop: string]: string }) {
    this.contentWellActiveStyles = Object.assign({}, this.contentWellDefaultStyles, this.contentWellActiveStyles,
      styles);
    this.contentWell.style.cssText = this.styleObjToString(this.contentWellActiveStyles);
  }

  set graphStyles(styles: { [prop: string]: string }) {
    this.graphActiveStyles = Object.assign({}, this.graphDefaultStyles, this.graphActiveStyles, styles);
    for (let childEl of this.graphChildren) {
      const margins = {
        "margin-top": this.graphMargin,
        "margin-bottom": this.graphChildren.indexOf(
          childEl) === this.graphChildren.length - 1 ? this.graphMargin : "inherit"
      };
      childEl.style.cssText = this.styleObjToString(Object.assign({}, this.graphActiveStyles, margins));
    }
  }

  set scrollCoverStyles(styles: { [prop: string]: string }) {
    this.scrollCoverActiveStyles = Object.assign({}, this.scrollCoverDefaultStyles, this.scrollCoverActiveStyles,
      styles);
    this.scrollCover.style.cssText = this.styleObjToString(this.scrollCoverActiveStyles);
  }

  constructor(root: HTMLElement | string, graphs: string[], opts?: { graphMargin?: string }) {
    if (!root || !graphs) {
      throw new Error(`Class ScrollyTeller is missing required arguments. Please specify a root element and graphs of text.
                Given: {
                    root: ${root},
                    graphs: ${graphs}
                }`);
    }
    this.anchorRoot = (typeof root === 'string' ? <HTMLElement>document.querySelector(root) : <HTMLElement>root);
    this.graphs = graphs;
    this.graphicRoot = this.createGraphicRoot();
    this.scrollCover = this.createScrollCover();
    this.contentWell = this.createContentWell();
    this.graphChildren = Array.prototype.slice.call(this.contentWell.querySelectorAll("p"));
    this.anchorRoot.appendChild(this.graphicRoot);
    this.scrollCover.appendChild(this.contentWell);
    this.anchorRoot.appendChild(this.scrollCover);

    this.topSpacer = document.createElement("span");
    this.bottomSpacer = document.createElement("span");
    this.topSpacer.id = "scrolly-teller-top-spacer";
    this.bottomSpacer.id = "scrolly-teller-bottom-spacer";
    this.topSpacer.style.height = this.bottomSpacer.style.height = "80vh";
    if (!this.anchorRoot.parentElement) {
      throw new Error("Root element must be attached to DOM");
    }
    this.anchorRoot.parentElement.insertBefore(this.topSpacer, this.anchorRoot);
    this.anchorRoot.parentElement.insertBefore(this.bottomSpacer, this.anchorRoot.nextSibling);

    document.addEventListener("scroll", this.scrollThrottler(this.activationHandler));
  }


  activate(): ScrollyTeller {
    document.addEventListener("scroll", this.scrollThrottler(this.scrollEmitterFunction));
    this.events.emit({event: "activated"});
    this.active = true;
    return this;
  }

  deactivate(): ScrollyTeller {
    document.removeEventListener("scroll", this.scrollThrottler(this.scrollEmitterFunction.bind(this)));
    this.events.emit({event: "deactivated"});
    this.active = false;
    return this;
  }

  private activationHandler() {
    const topRect = this.topSpacer.getBoundingClientRect();
    const botRect = this.bottomSpacer.getBoundingClientRect();
    const scrollDown = window.scrollY > this.lastScroll;
    this.lastScroll = window.scrollY;
    const viewHeight = (window.innerHeight || document.documentElement.clientHeight);

    if (topRect.bottom >- 0 && topRect.bottom <= viewHeight) {
      if (!this.topInView && scrollDown) {
        this.activate();
        this.topInView = true;
      }
      if (!this.topInView && !scrollDown) {
        this.deactivate();
        this.topInView = true;
      }
    } else {
      this.topInView = false;
    }

    if (botRect.bottom >= 0 && botRect.bottom <= viewHeight) {
      if (!this.botInView && scrollDown) {
        this.deactivate();
        this.botInView = true;
      }
      if (!this.botInView && !scrollDown) {
        this.activate();
        this.botInView = true;
      }
    } else {
      this.botInView = false;
    }
  }

  private scrollEmitterFunction() {
    const boundingRects = this.graphChildren.map((el) => el.getBoundingClientRect());
    for (let elRect of boundingRects) {
      const idx = boundingRects.indexOf(elRect);
      const inView = Boolean(this.graphChildren[idx].dataset.viewable);
      if (!inView) {
        if (elRect.top >= 0 && elRect.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
          this.graphChildren[idx].dataset.viewable = "true";
          this.events.emit({event: "entered", el: `scrolly-graph-${idx}`})
        }
      } else {
        if (elRect.bottom <= 0 || elRect.top >= (window.innerHeight || document.documentElement.clientHeight)) {
          this.graphChildren[idx].dataset.viewable = "";
          this.events.emit({event: "exited", el: `scrolly-graph-${idx}`})
        }
      }
    }
    this.ticking = false;
  }

  private scrollThrottler(fn: () => void) {
    return () => {
      if (!this.ticking) {
        window.requestAnimationFrame(fn.bind(this));
      }
      this.ticking = true;
    }
  }

  private createContentWell(): HTMLElement {
    const contentWell = document.createElement("div");
    contentWell.style.cssText = this.styleObjToString(this.contentWellDefaultStyles);
    for (let graph of this.graphs) {
      const idx = this.graphs.indexOf(graph);
      let p = document.createElement("p");
      p.style.cssText = this.styleObjToString(this.graphDefaultStyles);
      p.style.marginTop = this.graphMargin;
      if (idx === this.graphs.length - 1) {
        p.style.marginBottom = this.graphMargin;
      }
      p.innerText = graph;
      p.id = `scrolly-teller-graph-${idx}`;
      p.classList.add("scrolly-teller-graph");
      contentWell.appendChild(p);
    }
    return contentWell;
  }

  private createScrollCover(): HTMLElement {
    const scrollCover = document.createElement("div");
    scrollCover.style.cssText = this.styleObjToString(this.scrollCoverDefaultStyles);
    return scrollCover;
  }

  private createGraphicRoot(): HTMLElement {
    const graphicRoot = document.createElement("div");
    graphicRoot.style.cssText = this.styleObjToString(this.graphicRootDefaultStyles);
    return graphicRoot;
  }

  private styleObjToString(styleObj: any): string {
    let str = "";
    for (let prop in styleObj) {
      if (styleObj.hasOwnProperty(prop)) {
        str += `${prop}: ${styleObj[prop]};`
      }
    }
    return str;
  }
}