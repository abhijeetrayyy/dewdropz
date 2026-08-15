import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View , useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/ui/IconButton";
import { StatusCap } from "@/components/ui/StatusCap";
import { Topography } from "@/components/editorial/Topography";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { IndexList } from "@/components/editorial/IndexList";
import { Body, Display1, Display2, Eyebrow } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERKS = [
  { title: "Your pack, everywhere", body: "Start on your phone, finish on the web — same cart, same saved gear." },
  { title: "Order tracking", body: "Live status from our workshop in Dehradun to your door." },
  { title: "Your designs, kept", body: "Anything you make in the studio is saved to re-order later." },
];

export default function SignUpScreen() {
  const { signUp } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const [full, setFull] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<{ full?: string; email?: string; pw?: string }>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handle() {
    const errs: typeof fieldErrs = {};
    if (!full.trim()) errs.full = "Required";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email";
    if (pw.length < 6) errs.pw = "At least 6 characters";
    setFieldErrs(errs);
    if (Object.keys(errs).length > 0) {
      haptics.warning();
      return;
    }
    setLoading(true);
    setErr("");
    const r = await signUp(email.trim(), pw, full.trim());
    setLoading(false);
    if (r.error) {
      setErr(r.error);
      haptics.error();
    } else {
      haptics.success();
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <View style={s.root}>
        <StatusBar style="dark" />
        <View style={[s.top, { paddingTop: insets.top + 6 }]}>
          <IconButton name="arrow_back" onPress={() => router.replace("/auth/login")} />
        </View>
        <View style={s.successBody}>
          <View style={s.mailMark}>
            <Icon name="mail" size={26} color={C.paper} />
          </View>
          <Eyebrow color={C.forest} style={{ marginTop: S.xl }}>
            Almost there
          </Eyebrow>
          <Rule weight="strong" style={{ marginTop: 9 }} />
          <Display1 style={{ marginTop: S.md }}>Check your email.</Display1>
          <Body color={C.textMid} style={{ marginTop: 10 }}>
            We&apos;ve sent a confirmation link to{" "}
            <Text style={{ fontFamily: F.bodyBold, color: C.ink }}>{email.trim()}</Text>. Tap it and you&apos;re in.
          </Body>
          <Button
            title="Back to sign in"
            variant="dark"
            onPress={() => router.replace("/auth/login")}
            style={{ marginTop: S.xl, alignSelf: "flex-start" }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusCap />

      <View style={[s.panel, { paddingTop: insets.top + 10 }]}>
        <Topography
          width={SCREEN_W}
          height={280}
          color={C.sage}
          opacity={0.13}
          lines={9}
          seed={4.7}
          originX={0.86}
          originY={0.24}
        />
        <View style={s.top}>
          <IconButton
            name="arrow_back"
            tone="glass"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
          <Text style={s.kicker}>FREE · NO SPAM</Text>
        </View>

        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.md }}>
          <Text style={s.panelEyebrow}>CREATE AN ACCOUNT</Text>
          <Text style={s.panelTitle}>Join the{"\n"}expedition.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.block }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {err ? (
          <View style={s.errBox}>
            <Icon name="error" size={16} color={C.danger} />
            <Body color={C.danger} style={{ flex: 1 }}>
              {err}
            </Body>
          </View>
        ) : null}

        <View style={{ marginTop: S.xl }}>
          <Input
            label="Full name"
            value={full}
            onChangeText={(v) => {
              setFull(v);
              setFieldErrs((p) => ({ ...p, full: undefined }));
            }}
            autoCapitalize="words"
            autoComplete="name"
            err={fieldErrs.full}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setFieldErrs((p) => ({ ...p, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            err={fieldErrs.email}
          />
          <Input
            label="Password"
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setFieldErrs((p) => ({ ...p, pw: undefined }));
            }}
            secureTextEntry
            err={fieldErrs.pw}
            hint="At least 6 characters"
          />
        </View>

        <Button title="Create account" loading={loading} onPress={handle} style={{ width: "100%" }} />

        <View style={s.switchRow}>
          <Text style={s.switchT}>Already have one?</Text>
          <Button title="Sign in" variant="link" onPress={() => router.replace("/auth/login")} />
        </View>

        {/* What the account is actually for — v4 asked for three fields and
            gave one line of justification. */}
        <View style={{ marginTop: S.section }}>
          <Display2>What you get.</Display2>
          <IndexList items={PERKS} style={{ marginTop: S.md }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  panel: {
    backgroundColor: C.ink,
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
    marginBottom: S.block,
  },
  panelEyebrow: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, color: C.sage },
  panelTitle: { fontFamily: F.display, fontSize: 36, lineHeight: 39, letterSpacing: -0.2, color: C.paper, marginTop: 9 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: "rgba(251,247,239,0.6)" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: S.gutter },
  errBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.danger12, borderRadius: R.panel, padding: 14, marginTop: S.lg },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: S.xl },
  switchT: { fontFamily: F.body, fontSize: 15, color: C.textMid },
  successBody: { flex: 1, justifyContent: "center", paddingHorizontal: S.gutter, paddingBottom: 60 },
  mailMark: { width: 64, height: 64, borderRadius: 999, backgroundColor: C.forest, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
});
