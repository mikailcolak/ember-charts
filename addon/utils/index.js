export const distinctPredicate = (value, index, array) => array.indexOf(value) === index;
export const uniq = arr => arr?.filter(distinctPredicate) ?? [];

export function createElement(tag, text, classNames, children) {
  const el = document.createElement(tag);
  if (text) {
    el.innerText = text;
  }
  if (classNames?.length) {
    el.classList.add(...classNames);
  }
  if (children?.length) {
    children.forEach(c => el.appendChild(c));
  }
  return el;
}

export function createSpan(text, classNames, children) {
  return createElement('span', text, classNames, children);
}

export function createBr(text, classNames, children) {
  return createElement('span', text, classNames, children);
}
