import { useState } from "react";
// useState wrapped in localStorage. Pretty simple
const prefix = "ascii2tilemap.";
export default function useLocalStorageState(key, defaultVal) {
  let myValue = defaultVal;
  let lsVal = localStorage.getItem(`${prefix}${key}`);
  if (typeof lsVal === "string") {
    try {
      myValue = JSON.parse(lsVal);
    } catch (e) {
      // Log and move on.
      console.error("Failed parsing key", key, "from localStorage", e);
    }
  }
  const [val, setVal] = useState(myValue);

  return [
    val,
    (val) => {
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(val));
      return setVal(val);
    },
  ];
}
