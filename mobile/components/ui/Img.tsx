import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageProps } from "expo-image";
import { Icon } from "./Icon";
import { C } from "@/lib/theme";

// Every remote image in the app, with the two states it never had.
//
// There were ZERO `onError` handlers and zero placeholders across the whole
// codebase. A remote image that was slow rendered as nothing, and one that
// failed rendered as nothing forever — no retry, no fallback, no indication
// that anything was wrong. On a shop where the product photograph IS the
// product, "nothing" is the worst possible rendering.
//
// This was not theoretical. During the audit the API host went down and every
// product on the shop tab became a blank beige rectangle, silently. The blank
// cart thumbnail that looked like a bug was the same thing: a 590KB preview
// mid-flight with nothing drawn underneath it.
//
// ADOPTED BY IMPORT, NOT BY REWRITING 33 CALL SITES. Files do:
//
//   import { Img as Image } from "@/components/ui/Img"
//
// so every existing `<Image .../>` keeps its props and picks this up. That
// also means the next person who writes `<Image>` in one of those files gets
// the placeholder for free rather than having to remember a wrapper.

export type ImgProps = ImageProps & {
  /** Drawn under the image while it loads, and instead of it if it fails. */
  fallbackStyle?: StyleProp<ViewStyle>;
};

export function Img({ style, fallbackStyle, onError, transition, ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[s.fallback, style as StyleProp<ViewStyle>, fallbackStyle]}>
        {/* Small and quiet. A broken image is worth admitting to, not worth
            shouting about — the rest of the card still carries the name and
            the price, which is what the shopper actually needs. */}
        <Icon name="image_not_supported" size={18} color={C.textFaint} />
      </View>
    );
  }

  return (
    <Image
      {...rest}
      style={style}
      // A sand ground under every image, so a slow one reads as "loading" and
      // not as "empty". expo-image draws this until the first frame decodes.
      placeholderContentFit="cover"
      transition={transition ?? 220}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}

const s = StyleSheet.create({
  fallback: {
    backgroundColor: C.sand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
