declare module 'expo-font' {
  type FontSource = {
    uri: string;
  } | number;
  type FontMap = {
    [fontFamily: string]: FontSource;
  };
  export function useFonts(map: FontMap): [boolean];
}
