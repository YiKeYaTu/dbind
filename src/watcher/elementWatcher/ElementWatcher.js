import { events, on } from '../../dom/event/Event';
import { deepClone, toArray, objectAssign, is, toHumpBack } from '../../utilityFunc/utilityFunc';
import { NOR_STATEMENT_TYPE, ONCE_STATEMENT_TYPE, CONST_STRING } from '../../parser/statementExtract';

export default class ElementWatcher {
  static instructions = ['data-if', 'data-else', 'data-else-if', 'data-html'];
  static escapeNode = ['script'];
  static instructionsHandle = {
    [ElementWatcher.instructions[0]]: '__handleIfInstruction',
    [ElementWatcher.instructions[1]]: '__handleElseInstruction',
    [ElementWatcher.instructions[2]]: '__handleElseIfInstruction',
    [ElementWatcher.instructions[3]]: '__handleHtmlInstruction',
  };
  constructor(base, BaseWatcher) {
    this.base = base;
    this.BaseWatcher = BaseWatcher;
    this.__setObIdAttr();
    this.instructions = this.__getInstructions();
    this.instructionsList = this.instructions.map(item => item.name);
    this.instructionsModel = null;
    this.events = this.__getEvents();
    this.attrs = this.__getAttrs();
    this.model = this.__getModel();

    this.renderCount = 0;

    this.rendering = false;
    this.resolvedInstructions = null;
    this.renderInf = null;
    this.childWatchers = null;
  }
  destructor() {
    let node = this.base.element;
    node.parentNode.removeChild(node);
    this.__destructorChild();
  }
  render(cb = () => { }) {
    this.resolvedInstructions = this.__execInstructions();
    this.renderInf = this.__handleResolvedInstructions();
    if (this.renderInf.shouldRender || this.renderInf.shouldRender === null) {
      if (this.renderInf.shouldRender) {
        this.__setBaseElementDisplay(this.base.pastDOMInformation.display);
      }
      this.__bindAttrs();
      if (this.renderInf.shouldInit) {
        this.__bindEvents();
      }
      if (!this.childWatchers) {
        this.__setChildWatcher();
      }
    } else {
      if(this.childWatchers) {
        this.__destructorChild();
        this.base.element.innerHTML = this.base.pastDOMInformation.innerHTML;
      }
      this.__setBaseElementDisplay('none');
    }
  }
  reset(cb = () => { }, prevData, nextData) {
    if (prevData !== nextData) {
      this.render(cb);
    }
  }
  __destructorChild() {
    this.childWatchers && this.childWatchers.forEach(item => item.destructor());
    this.childWatchers = null;
  }
  __setChildWatcher() {
    if (ElementWatcher.escapeNode.indexOf(this.base.pastDOMInformation.nodeName.toLowerCase()) > -1) return;
    if (this.renderInf.shouldRenderHtml) {
      this.childWatchers = [new this.BaseWatcher(
        this.base.element,
        objectAssign({}, this.base.obdata),
        null,
        this.BaseWatcher.TextWatcher,
        this.base.modelExtractId,
        this.base.components,
        this.base,
      )];
    } else {
      let previousWatcher = null;
      this.childWatchers = toArray(this.base.element.childNodes)
        .map((item, index) => {
          const childWatcher = new this.BaseWatcher(
            item,
            objectAssign({}, this.base.obdata),
            previousWatcher,
            null,
            this.base.modelExtractId,
            this.base.components,
            this.base,
            this.base.getChildId(index)
          );
          previousWatcher = childWatcher;
          return childWatcher;
        });
    }
  }
  __setBaseElementDisplay(display) {
    this.base.element.style.display = display;
  }
  __setObIdAttr() {
    this.base.element.setAttribute('data-ob-id', this.base.obId);
  }
  __getInstructionsModel() {
    let res = [];
    this.instructionsModel = {};
    this.instructions.forEach((instruction) => {
      this.base.modelExtract(instruction.value).forEach((item) => {
        res.push(item.value);
        this.instructionsModel[instruction.name] = item.value;
      });
    });
    if (this.hasElseInstruction()) {
      res = res.concat(this.__getPrevIfInstructionModel());
    }
    return res;
  }
  __getPrevIfInstructionModel() {
    let model = null;
    this.base.traversalPrevious((previousWatcher) => {
      if (previousWatcher.obtype === this.BaseWatcher.TextWatcher) return true;
      if (previousWatcher.obtype === this.BaseWatcher.ManagerWatcher) return false;
      if (previousWatcher.obwatcher.hasElseIfInstruction()) {
        model = previousWatcher.obwatcher.instructionsModel[ElementWatcher.instructions[2]];
        return false;
      }
      if (previousWatcher.obwatcher.hasIfInstruction()) {
        model = previousWatcher.obwatcher.instructionsModel[ElementWatcher.instructions[1]];
        return false;
      }
    });
    return model;
  }
  __getModel() {
    const instructionsModel = this.__getInstructionsModel(),
      attrsModel = this.__getAttrsModel();
    return instructionsModel.concat(attrsModel);
  }
  __getAttrsModel() {
    const res = [];
    this.attrs.obattrs.forEach((attr) => {
      attr.value.forEach((item) => {
        if (item.type === NOR_STATEMENT_TYPE) {
          this.base.modelExtract(item.value).forEach((model) => {
            res.push(model.value);
          });
        }
      });
    });
    return res;
  }
  hasIfInstruction() {
    return this.instructionsList.indexOf(ElementWatcher.instructions[0]) > -1;
  }
  hasElseInstruction() {
    return this.instructionsList.indexOf(ElementWatcher.instructions[1]) > -1;
  }
  hasElseIfInstruction() {
    return this.instructionsList.indexOf(ElementWatcher.instructions[2]) > -1;
  }
  hasHtmlInstruction() {
    return this.instructionsList.indexOf(ElementWatcher.instructions[3]) > -1;
  }
  __getInstructions() {
    return this.base.__filterAttr(ElementWatcher.instructions, true).map((item) => {
      this.base.removeAttr(item.name);
      return { name: item.name, value: item.value };
    });
  }
  __getAttrs() {
    const attrs = this.base.__filterAttr(events.concat(ElementWatcher.instructions), false);
    const obattrs = [],
      normalAttrs = [];
    attrs.forEach((attr) => {
      let parsed = this.base.statementExtract(attr.value);
      let type = null, ob = false;
      let obj = {};
      obj.name = attr.name;
      obj.value = parsed.map((item) => {
        if (item.type === NOR_STATEMENT_TYPE || item.type === ONCE_STATEMENT_TYPE) {
          ob = true;
        }
        return item;
      });
      if (ob === true) {
        obattrs.push(obj);
      } else {
        normalAttrs.push(obj);
      }
    });
    return { obattrs, normalAttrs };
  }
  __getEvents() {
    const eventAttrs = this.base.__filterAttr(events);
    const obEvents = [],
      onceEvents = [],
      normalEvents = [];
    eventAttrs.forEach((item) => {
      const parsed = this.base.statementExtract(item.value);
      let obj = {};
      obj.name = item.name;
      obj.value = parsed[0].value;
      if (parsed.length > 1) {
        throw '';
      } else {
        if (parsed[0].type === NOR_STATEMENT_TYPE) {
          obEvents.push(obj);
        } else if (parsed[0].type === ONCE_STATEMENT_TYPE) {
          onceEvents.push(obj);
        } else {
          normalEvents.push(obj);
        }
      }
    });
    return { obEvents, onceEvents, normalEvents };
  }
  __bindEvents() {
    const events = [this.events.obEvents, this.events.onceEvents];
    events.forEach((item, index) => {
      if (item.length === 0) return;
      let obdata = (index === 1 ? this.base.obdata : null);
      item.forEach((item) => {
        this.base.element[item.name] = null;
        this.base.removeAttr(item.name);
        on(this.base.element, item.name.substring(2), ($event) => {
          (new Function('data, $event', `with(data) { ${item.value} }`))(obdata || this.base.obdata, $event);
        });
      });
    });
  }
  __bindAttrs() {
    this.attrs.obattrs.forEach((attr) => {
      let str = '';
      attr.value.forEach((item) => {
        if (item.type === NOR_STATEMENT_TYPE || item.type === ONCE_STATEMENT_TYPE) {
          str += this.__toString(this.base.execStatement(item.value));
        } else {
          str += item.value;
        }
      });
      this.base.element.setAttribute(attr.name, str);
    });
  }
  __toString(val) {
    if(is(val, 'object')) {
      let str = '';
      for(let key in val) {
        str += `${toHumpBack(key)}:${val[key]};`;
      }
      return str;
    } else {
      return val;
    }
  }
  __execInstructions() {
    const resolved = {};
    this.instructions.forEach((item) => {
      resolved[item.name] = this.base.execStatement(item.value);
    });
    return resolved;
  }
  __handleResolvedInstructions() {
    const renderInf = {
      shouldRender: null,
      shouldRenderHtml: false,
      shouldInit: null,
    };
    for (let key in this.resolvedInstructions) {
      const resolvedInstruction = this.resolvedInstructions[key];
      this[ElementWatcher.instructionsHandle[key]](resolvedInstruction, renderInf);
    }
    renderInf.shouldInit = (renderInf.shouldRender === true || renderInf.shouldRender === null) && this.renderCount === 0;
    if (this.renderCount === 0 && renderInf.shouldRender === false) {
      this.renderCount --;
    };
    this.renderCount ++;
    return renderInf;
  }
  __handleIfInstruction(resolvedInstruction, renderInf) {
    return renderInf.shouldRender = !!resolvedInstruction;
  }
  __handleElseIfInstruction(resolvedInstruction, renderInf) {
    let ifFlag = this.__handleIfInstruction(resolvedInstruction, renderInf),
      elseFlag = this.__handleElseInstruction(resolvedInstruction, renderInf);
    return renderInf.shouldRender = ifFlag && elseFlag;
  }
  __handleElseInstruction(resolvedInstruction, renderInf) {
    let noError = false, shouldRender = true;
    this.base.traversalPrevious((previousWatcher) => {
      if (previousWatcher.obtype === this.BaseWatcher.TextWatcher) return true;
      if (previousWatcher.obtype === this.BaseWatcher.ManagerWatcher) return false;
      if (previousWatcher.obwatcher.hasElseInstruction()) return false;
      if (previousWatcher.obwatcher.renderInf.shouldRender === null) return false;
      if (previousWatcher.obwatcher.renderInf.shouldRender === true) shouldRender = false;
      if (previousWatcher.obwatcher.hasIfInstruction()) {
        noError = true;
        return false;
      }
    });
    if (!noError) throw new SyntaxError('Unexpected else');
    renderInf.shouldRender = shouldRender
    return shouldRender;
  }
  __handleHtmlInstruction(resolvedInstruction, renderInf) {
    renderInf.shouldRenderHtml = true;
  }
}