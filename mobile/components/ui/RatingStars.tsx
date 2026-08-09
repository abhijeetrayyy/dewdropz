import { TouchableOpacity, View } from "react-native";
import { C } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { Icon } from "./Icon";

type Props = { value: number; size?: number; onChange?: (v: number) => void };

export function RatingStars({ value, size = 14, onChange }: Props) {
  const editable = !!onChange;
  return (
    <View style={{ flexDirection: "row", gap: editable ? 6 : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <Icon name="star" size={size} color={filled ? C.clay : C.ruleStrong} filled={filled} />;
        if (!editable) return <View key={n}>{star}</View>;
        return (
          <TouchableOpacity
            key={n}
            hitSlop={8}
            onPress={() => {
              haptics.select();
              onChange!(n);
            }}
          >
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
