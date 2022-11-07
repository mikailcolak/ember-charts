import { helper as buildHelper } from '@ember/component/helper';
import { get } from '@ember/object';

export function pick([propertyToPick, fnToPass]) {
  return (arg) => {
    return fnToPass(get(arg, propertyToPick));
  }
}

export default buildHelper(pick);
