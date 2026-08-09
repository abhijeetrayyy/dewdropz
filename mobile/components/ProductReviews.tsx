import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { RatingStars } from "@/components/ui/RatingStars";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/Button";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Body, Display1, Mono, Title } from "@/components/ui/Type";
import { useAuthStore } from "@/stores/auth";
import { useCreateReviewMutation, useProductRatingQuery, useProductReviewsQuery } from "@/lib/queries";
import { toast } from "@/components/ui/Toast";
import { C, F, R, S } from "@/lib/theme";

const AVATAR_TONES = [
  { bg: C.forest12, fg: C.forestDeep },
  { bg: C.clay12, fg: C.clayDeep },
  { bg: C.cream, fg: C.textMid },
];

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Reviews. The summary is now a proper masthead figure — the average set at
// display size next to the star row and the count in mono — rather than v4's
// small white card floating alone at the left margin, which read as a stray
// widget rather than a summary of anything.
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
    <View style={{ marginTop: S.section }}>
      <SectionHead eyebrow="Field reports" title="What people found." size="d3" />

      {rating && rating.count > 0 ? (
        <>
          <View style={s.summary}>
            <Display1>{rating.average.toFixed(1)}</Display1>
            <View style={{ flex: 1, gap: 6 }}>
              <RatingStars value={rating.average} size={15} />
              <Mono color={C.textMuted}>
                {rating.count} {rating.count === 1 ? "REPORT" : "REPORTS"}
              </Mono>
            </View>
          </View>
          <Rule weight="soft" />
        </>
      ) : (
        <Body color={C.textMuted} style={{ marginTop: S.lg }}>
          No field reports yet — be the first to say how it held up.
        </Body>
      )}

      {reviews.map((r, i) => {
        const name = r.profile?.full_name || "Anonymous";
        const tone = AVATAR_TONES[name.length % AVATAR_TONES.length];
        return (
          <View key={r.id}>
            {i > 0 ? <Rule weight="hair" /> : null}
            <View style={s.review}>
              <View style={s.reviewHead}>
                <View style={[s.avatar, { backgroundColor: tone.bg }]}>
                  <Text style={[s.avatarT, { color: tone.fg }]}>{initialsFor(name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Title>{name}</Title>
                    {r.is_verified ? <Icon name="verified" size={15} color={C.forest} filled /> : null}
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <RatingStars value={r.rating} size={12} />
                  </View>
                </View>
              </View>
              {r.title ? <Title style={{ marginTop: S.md }}>{r.title}</Title> : null}
              {r.content ? (
                <Body color={C.textMid} style={{ marginTop: 6 }}>
                  {r.content}
                </Body>
              ) : null}
            </View>
          </View>
        );
      })}
      {reviews.length > 0 ? <Rule weight="soft" /> : null}

      {user ? (
        showForm ? (
          <View style={s.form}>
            <Mono color={C.textMuted}>YOUR RATING</Mono>
            <RatingStars value={stars} size={26} onChange={setStars} />
            <TextInput
              placeholder="Sum it up in a few words"
              placeholderTextColor={C.textFaint}
              value={title}
              onChangeText={setTitle}
              style={s.input}
              selectionColor={C.forest}
            />
            <TextInput
              placeholder="How did it hold up? Where did you take it?"
              placeholderTextColor={C.textFaint}
              value={content}
              onChangeText={setContent}
              multiline
              style={[s.input, s.inputMulti]}
              selectionColor={C.forest}
            />
            <View style={{ flexDirection: "row", gap: S.sm }}>
              <Button title="Cancel" variant="quiet" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
              <Button title="Submit" variant="dark" loading={createReview.isPending} onPress={submit} style={{ flex: 1.4 }} />
            </View>
          </View>
        ) : (
          <Button title="Write a field report" variant="link" icon="edit" onPress={() => setShowForm(true)} style={{ marginTop: S.lg }} />
        )
      ) : (
        <Body color={C.textFaint} style={{ marginTop: S.lg }}>
          Sign in to write a field report.
        </Body>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: S.lg, paddingVertical: S.lg },
  review: { paddingVertical: S.lg },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  avatar: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatarT: { fontFamily: F.monoBold, fontSize: 11 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  form: { marginTop: S.lg, gap: S.md },
  input: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.ruleMed,
    borderRadius: R.panel,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputMulti: { height: 96, textAlignVertical: "top" },
});
