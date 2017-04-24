import { EventEmitter } from "./EventEmitter";

export interface CssStyleObj {
  [prop: string]: string;
}

export interface EventSubscription {
  [trigger: string]: {
    [direction: string]: EventEmitter<any>
  };
}

export class ScrollyTeller {
  graphs: string[];
  anchorRoot: HTMLElement;
  graphicPlate: HTMLElement;
  frontPlate: HTMLElement;
  contentWell: HTMLElement;
  active: boolean = false;
  topSpacer: HTMLElement;
  bottomSpacer: HTMLElement;
  private state: any = {};
  private _subscriptions: EventSubscription = {};
  private _graphMargin: string = `${window.innerHeight * .7}px`;
  private graphChildren: HTMLElement[] = [];

  // Scroll related props
  private ticking = false;
  private lastScroll = 0;

  // Style related props
  private graphicPlateActiveStyles: CssStyleObj;
  private contentWellActiveStyles: CssStyleObj;
  private graphActiveStyles: CssStyleObj;
  private frontPlateActiveStyles: CssStyleObj;
  private graphicPlateDefaultStyles: CssStyleObj = {
    "background-color": "inherit",
    "width": "100vw",
    "height": `${window.innerHeight}px`,
    "position": "fixed",
    "top": "0",
    "left": "0",
    "z-index": "-1"
  };
  private contentWellDefaultStyles: CssStyleObj = {
    "max-width": "700px",
    "width": "100vw"
  };
  private graphDefaultStyles: CssStyleObj = {};
  private frontPlateDefaultStyles = {
    "width": "100vw",
    "z-index": "5"
  };

  constructor(root: HTMLElement | string, graphs: string[]) {
    if (!root || !graphs) {
      throw new Error(
        `Class ScrollyTeller is missing required arguments. Please specify a root element and graphs of text.
        Given: {
          root: ${root},
          graphs: ${graphs}
        }`
      )
    }
    this.anchorRoot = (typeof root === "string" ? <HTMLElement>document.querySelector(root) : <HTMLElement>root);
    this.graphs = graphs;
    this.graphicPlate = this.createGraphicPlate();
    this.frontPlate = this.createFrontPlate();
    this.contentWell = this.createContentWell();
    this.anchorRoot.appendChild(this.graphicPlate);
    this.frontPlate.appendChild(this.contentWell);
    this.anchorRoot.appendChild(this.frontPlate);

    this._subscriptions = {
      "activated": {
        "fromTop": new EventEmitter(),
        "fromBottom": new EventEmitter()
      },
      "deactivated": {
        "fromTop": new EventEmitter(),
        "fromBottom": new EventEmitter()
      }
    };

    this.topSpacer = document.createElement("div");
    this.bottomSpacer = document.createElement("div");
    this.topSpacer.id = "scrolly-teller-top-spacer";
    this.bottomSpacer.id = "scrolly-teller-bottom-spacer";
    this.topSpacer.style.height = this.bottomSpacer.style.height = `${window.innerHeight * .8}px`;
    if (!isInDOMTree(this.anchorRoot)) {
      throw new Error("Root element must be attached to DOM")
    }
    // This sucks that we have to cast here but the check right above assures us that parentElement exists
    // on anchorRoot.
    (<any>this.anchorRoot).parentElement.insertBefore(this.topSpacer, this.anchorRoot);
    (<any>this.anchorRoot).parentElement.insertBefore(this.bottomSpacer, this.anchorRoot.nextSibling);

    document.addEventListener("scroll", this.scrollHandler.bind(this));

    function isInDOMTree(node: Node) {
      // If the farthest-back ancestor of our node has a "body"
      // property (that node would be the document itself),
      // we assume it is in the page's DOM tree.
      return !!((<Document>findUltimateAncestor(node)).body);
    }
    function findUltimateAncestor(node: Node) {
      // Walk up the DOM tree until we are at the top (parentNode
      // will return null at that point).
      // NOTE: this will return the same node that was passed in
      // if it has no ancestors.
      let ancestor = node;
      while(ancestor.parentNode) {
        ancestor = ancestor.parentNode;
      }
      return ancestor;
    }
  }

  /**
   * Sets ScrollyTeller into an active state, emitting the Activated event.
   * @param direction
   */
  private activate(direction: "up" | "down") {
    const emitDirection = direction === "down" ? "fromTop" : "fromBottom";
    this.active = true;
    this._subscriptions.activated[emitDirection].emit({state: this.state, setState: this.setState, scrollyTeller: this });
  }

  /**
   * Sets ScrollyTeller into an inactive state, emitting the Activated event.
   * @param direction
   */
  private deactivate(direction: "up" | "down") {
    const emitDirection = direction === "down" ? "fromTop" : "fromBottom";
    this.active = false;
    this._subscriptions.deactivated[emitDirection].emit({state: this.state, setState: this.setState, scrollyTeller: this });
  }

  /**
   * This method is meant to listen on scroll events. It implements the majority of the logic, firing events
   * and checking for dom elements in view.
   */
  private scrollHandler(): void {
    if (this.ticking) {
      window.requestAnimationFrame(() => {
        const topRect = this.topSpacer.getBoundingClientRect();
        const botRect = this.bottomSpacer.getBoundingClientRect();
        const scrollDown = window.scrollY > this.lastScroll;
        const viewHeight = (window.innerHeight || document.documentElement.clientHeight);
        this.lastScroll = window.scrollY;

        // Trigger activate/deactivate as top of graphic comes into or leaves view
        if (topRect.bottom > 0 && topRect.bottom <= viewHeight) {
          if (scrollDown) {
            if (!this.active) {
              this.activate(scrollDown ? "down" : "up");
            }
          } else {
            if (this.active) {
              this.deactivate(scrollDown ? "down" : "up");
            }
          }
        }

        // Trigger activate/deactivate as bottom of graphic comes into of leaves view
        if (botRect.bottom >= 0 && botRect.bottom <= viewHeight) {
          if (scrollDown) {
            if (this.active) {
              this.deactivate(scrollDown ? "down" : "up");
            }
          } else {
            if (!this.active) {
              this.activate(scrollDown ? "down" : "up");
            }
          }
        }

        // Graph emitter logic
        if (this.active) { // This could be expensive so we only want to bother if ScrollyTeller is active
          const boundingRects = this.graphChildren.map(el => el.getBoundingClientRect());
          boundingRects.forEach((elRect, idx) => {
            const el = this.graphChildren[idx];
            const inView = Boolean(el.dataset.viewable);
            if (!inView) {
              const emitterString = scrollDown ? "enterBottom" : "enterTop";
              if (elRect.top >= 0 && elRect.bottom <= viewHeight) {
                el.dataset.viewable = "true";
                this._subscriptions[`graph${idx}`][emitterString].emit({ state: this.state, setState: this.setState, scrollyTeller: this });
              }
            } else {
              const emitterString = scrollDown ? "exitTop" : "exitBottom";
              if (elRect.bottom <= 0 || elRect.top >= viewHeight) {
                el.dataset.viewable = "false";
                this._subscriptions[`graph${idx}`][emitterString].emit({ state: this.state, setState: this.setState, scrollyTeller: this });
              }
            }
          })
        }
      });
      this.ticking = false;
    }
    this.ticking = true;
  }

  /**
   * Method for setting state. To be used in emitted events.
   * @param state
   */
  private setState(state: any) {
    this.state = state;
  }

  /**
   * Creates an element intended to stand in front of the graphic plate. Content well is placed inside.
   * @returns {HTMLElement}
   */
  private createFrontPlate(): HTMLElement {
    const frontPlate = document.createElement("div");
    frontPlate.style.cssText = this.styleObjToString(this.frontPlateDefaultStyles);
    return frontPlate;
  }

  /**
   * Creates an element into which text content is placed.
   * @returns {HTMLElement}
   */
  private createContentWell(): HTMLElement {
    const contentWell = document.createElement("div");
    contentWell.style.cssText = this.styleObjToString(this.contentWellDefaultStyles);
    for (let graph of this.graphs) {
      const idx = this.graphs.indexOf(graph);
      this._subscriptions[`graph${idx}`] = {
        "enterTop": new EventEmitter(),
        "enterBottom": new EventEmitter(),
        "exitTop": new EventEmitter(),
        "exitBottom": new EventEmitter()
      };
      const p = document.createElement("p");
      p.style.cssText = this.styleObjToString(this.graphDefaultStyles);
      p.style.marginTop = this.graphMargin;
      if (idx === this.graphs.length - 1) {
        p.style.marginBottom = this.graphMargin;
      }
      p.innerHTML = graph;
      p.id = `scrolly-teller-graph-${idx}`;
      p.classList.add("scrolly-teller-graph");
      this.graphChildren.push(p);
      contentWell.appendChild(p);
    }
    return contentWell;
  }

  /**
   * Creates an element into which the graphic can be attached.
   * @returns {HTMLElement}
   */
  private createGraphicPlate(): HTMLElement {
    const graphicPlate = document.createElement("div");
    graphicPlate.style.cssText = this.styleObjToString(this.graphicPlateDefaultStyles);
    return graphicPlate;
  }

  /**
   * Takes an object with css style properties and values and serializes it into a css style string.
   * @param styleObj
   * @returns {string}
   */
  private styleObjToString(styleObj: any): string {
    let str = "";
    for (let prop in styleObj) {
      if (styleObj.hasOwnProperty(prop)) {
        str += `${prop}: ${styleObj[prop]};`
      }
    }
    return str
  }

  // Getters and Setters
  get graphMargin() {
    return this._graphMargin;
  }

  set graphMargin(margin: string) {
    this._graphMargin = margin;
    for (let childEl of this.graphChildren) {
      const margins = {
        "margin-top": this._graphMargin,
        "margin-bottom": this.graphChildren.indexOf(
          childEl) === this.graphChildren.length - 1 ? this._graphMargin : "inherit"
      };
      this.graphActiveStyles = Object.assign({}, this.graphActiveStyles, margins);
      childEl.style.cssText = this.styleObjToString(this.graphActiveStyles)
    }
  }

  set graphicPlateStyles(styles: CssStyleObj) {
    this.graphicPlateActiveStyles = Object.assign({}, this.graphicPlateActiveStyles, styles);
    this.graphicPlate.style.cssText = this.styleObjToString(this.graphicPlateActiveStyles);
  }

  set contentWellStyles(styles: CssStyleObj) {
    this.contentWellActiveStyles = Object.assign({}, this.contentWellActiveStyles, styles);
    this.contentWell.style.cssText = this.styleObjToString(this.contentWellActiveStyles);
  }

  set graphStyles(styles: CssStyleObj) {
    this.graphActiveStyles = Object.assign({}, this.graphActiveStyles, styles);
    for (let childEl of this.graphChildren) {
      const margins = {
        "margin-top": this.graphMargin,
        "margin-bottom": this.graphChildren.indexOf(
          childEl) === this.graphChildren.length - 1 ? this.graphMargin : "inherit"
      };
      childEl.style.cssText = this.styleObjToString(Object.assign({}, this.graphActiveStyles, margins));
    }
  }

  set frontPlateStyles(styles: CssStyleObj) {
    this.frontPlateActiveStyles = Object.assign({}, this.frontPlateActiveStyles, styles);
    this.frontPlate.style.cssText = this.styleObjToString(this.frontPlateActiveStyles);
  }

  set subscriptions(subObj: any) {
    for (let trigger in subObj) {
      if (subObj.hasOwnProperty(trigger)) {
        for (let direction in subObj[trigger]) {
          if (subObj[trigger].hasOwnProperty(direction)) {
            if (this._subscriptions[trigger][direction]) {
              this._subscriptions[trigger][direction].subscribe(subObj[trigger][direction])
            }
          }
        }
      }
    }
  }
}
