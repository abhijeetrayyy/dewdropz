import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Heart } from "lucide-react-native";
import { C, F } from "@/lib/theme";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";

type Props = { productId: string; slug: string; name: string; price: number; imageUri: string; collectionLabel?: string };

export function ProductCard({ productId, slug, name, price, imageUri, collectionLabel }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const { has, toggle } = useWishlistStore();
  const saved = has(slug);

  return (
    <Link href={`/product/${slug}`} asChild>
      <TouchableOpacity style={s.card} activeOpacity={0.94}>
        <View style={s.imgW}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.img} contentFit="cover" transition={200} />
          ) : (
            <View style={s.ph}>
              <Text style={s.phT}>DEWDROPZ</Text>
            </View>
          )}
          {collectionLabel && (
            <View style={s.cb}>
              <Text style={s.cbT}>{collectionLabel.toUpperCase()}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              haptics.tap();
              toggle(slug);
            }}
            style={s.heart}
            hitSlop={10}
          >
            <Heart size={16} strokeWidth={2} color={saved ? C.forest : C.mid} fill={saved ? C.forest : "transparent"} />
          </TouchableOpacity>
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={2}>
            {name}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              e.preventDefault();
              haptics.tap();
              addItem({ productId, slug, name, price, image: imageUri });
              toast.success("Added to cart");
            }}
          >
            <Text style={s.price}>{formatPrice(price)}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const s = StyleSheet.create({
  card: { width: "100%" },
  imgW: { aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden", backgroundColor: C.rule },
  img: { width: "100%", height: "100%" },
  ph: { flex: 1, alignItems: "center", justifyContent: "center" },
  phT: { fontFamily: F.display, fontSize: 9, letterSpacing: 3, color: C.forest + "66" },
  cb: { position: "absolute", top: 10, left: 10, backgroundColor: C.ink + "AA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cbT: { fontFamily: F.mono, fontSize: 7, letterSpacing: 2, color: C.sage },
  heart: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFFEE", alignItems: "center", justifyContent: "center", shadowColor: C.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  info: { paddingTop: 12 },
  name: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.text, fontWeight: "500" },
  price: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest, marginTop: 6, fontWeight: "700" },
});
