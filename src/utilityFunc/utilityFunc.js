export function toArray(arrayLike) {
  return [].slice.call(arrayLike);
}
export function delay(fn) {
  const t = Date.now();
  setTimeout(function () {
    fn(Date.now() - t);
  });
}
export function is(target, type) {
  return Object.prototype.toString.call(target).toLowerCase() === `[object ${type.toLowerCase()}]`;
}
export function deepClone(t) {
  if (is(t, 'array')) {
    t = t.map((item) => {
      return deepClone(item);
    });
  } else if (is(t, 'object')) {
    const nt = {};
    for (let key in t) {
      nt[key] = deepClone(t[key]);
    }
    return nt;
  } else {
    return t;
  }
}
export function randomId() {
  return Date.now() + Math.random();
}
export function objectAssign() {
  const arg = [].slice.call(arguments, 1);
  const target = arguments[0];
  arg.forEach((item) => {
    for (let key in item) {
      target[key] = item[key];
    }
  });
  return target;
}
export function walkElement(dom, cb) {
  if (is(dom, 'array')) {
    dom.forEach((item) => {
      while (item) {
        cb(item);
        walkElement(item.firstElementChild, cb);
        item = item.nextElementSibling;
      }
    });
  } else {
    while (dom) {
      cb(dom);
      walkElement(dom.firstElementChild, cb);
      dom = dom.nextElementSibling;
    }
  }
}
export function toHump(str) {
  return str.replace(/-(.)/, (a, b) => {
    return String.fromCharCode(b.charCodeAt(0) - 32);
  });
}

export function toHumpBack(str) {
  let strArr = str.split('');
  strArr = strArr.map((item) => {
    let code = item.charCodeAt(0);
    if(code >= 65 && code <= 90) {
      return '-' + String.fromCharCode(code + 32);
    }
    return item;
  });
  return strArr.join('');
}