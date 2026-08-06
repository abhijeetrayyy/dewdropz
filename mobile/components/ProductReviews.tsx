import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { RatingStars } from "@/components/ui/RatingStars";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/stores/auth";
import { useCreateReviewMutation, useProductRatingQuery, useProductReviewsQuery } from "@/lib/queries";
import { toast } from "@/components/ui/Toast";
import { C, F } from "@/lib/theme";

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuthStore();
  const { data: rating } = useProductRatingQuery(productId);
  const { data: reviews = [] } = useProductReviewsQuery(productId);
  const createReview = useCreateReviewMutation(productId);

  const [showForm, setShowForm] = useState(false);
  const [stars, setStars] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function submit() {
    if (stars === 0) {
      toast.error("Pick a star rating first");
      return;
    }
    if (!user) return;
    try {
      await createReview.mutateAsync({ product_id: productId, user_id: user.id, rating: stars, title, content });
      toast.success("Review submitted — pending approval");
      setShowForm(false);
      setStars(0);
      setTitle("");
      setContent("");
    } catch {
      toast.error("Couldn't submit your review");
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.label}>Reviews</Text>
        {rating && rating.count > 0 ? (
          <View style={s.summary}>
            <RatingStars value={rating.average} />
            <Text style={s.summaryT}>
              {rating.average} · {rating.count} review{rating.count !== 1 ? "s" : ""}
            </Text>
          </View>
        ) : (
          <Text style={s.empty}>No reviews yet — be the first to field-test this.</Text>
        )}
      </View>

      {reviews.map((r) => (
        <View key={r.id} style={s.review}>
          <View style={s.reviewHead}>
            <RatingStars value={r.rating} size={12} />
            {r.is_verified && (
              <View style={s.verified}>
                <BadgeCheck size={11} strokeWidth={2} color={C.sage} />
                <Text style={s.verifiedT}>Verified purchase</Text>
              </View>
            )}
          </View>
          {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
          {r.content ? <Text style={s.reviewBody}>{r.content}</Text> : null}
          <Text style={s.reviewBy}>{r.profile?.full_name || "Anonymous"}</Text>
        </View>
      ))}

      {user ? (
        showForm ? (
          <View style={s.form}>
            <RatingStars value={stars} size={22} onChange={setStars} />
            <TextInput
              placeholder="Title (optional)"
              placeholderTextColor={C.light}
              value={title}
              onChangeText={setTitle}
              style={s.input}
            />
            <TextInput
              placeholder="Tell other trekkers how it held up..."
              placeholderTextColor={C.light}
              value={content}
              onChangeText={setContent}
              multiline
              style={[s.input, { height: 80, textAlignVertical: "top" }]}
            />
            <Button title="Submit Review" loading={createReview.isPending} onPress={submit} />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowForm(true)} style={{ marginTop: 16 }}>
            <Text style={s.writeLink}>Write a review →</Text>
          </TouchableOpacity>
        )
      ) : (
        <Text style={s.signInHint}>Sign in to write a review.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 36, borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 24 },
  head: { marginBottom: 18 },
  label: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 10 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryT: { fontFamily: F.body, fontSize: 13, color: C.mid },
  empty: { fontFamily: F.body, fontSize: 13, color: C.light },
  review: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.rule },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedT: { fontFamily: F.body, fontSize: 10, color: C.forest },
  reviewTitle: { fontFamily: F.bodyBold, fontSize: 13, color: C.text, marginTop: 8 },
  reviewBody: { fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.mid, marginTop: 4 },
  reviewBy: { fontFamily: F.body, fontSize: 11, color: C.light, marginTop: 8 },
  form: { marginTop: 18, gap: 12 },
  input: { fontFamily: F.body, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.rule, borderRadius: 10, padding: 12 },
  writeLink: { fontFamily: F.bodyBold, fontSize: 13, color: C.forest },
  signInHint: { fontFamily: F.body, fontSize: 13, color: C.light, marginTop: 16 },
});
