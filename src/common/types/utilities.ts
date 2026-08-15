// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

export type CallableKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof T];
