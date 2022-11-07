import { helper as buildHelper } from '@ember/component/helper';

export function eq([lhs, rhs]) {
  return lhs == rhs;
}

export default buildHelper(eq);
