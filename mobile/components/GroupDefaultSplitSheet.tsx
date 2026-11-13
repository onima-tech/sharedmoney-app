import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { WEB_MAX_WIDTH } from "../constants/layout";
import { Participant } from "../types";
import { clampShareCount, MAX_SHARE_COUNT } from "../utils/splits";
import { GroupDefaultSplitMode } from "../utils/groupSplit";

interface GroupDefaultSplitSheetProps {
  visible: boolean;
  groupName?: string;
  participants: Participant[];
  mode: GroupDefaultSplitMode;
  weights: Record<string, number>;
  saving?: boolean;
  error?: string | null;
  /** Preview shots render the sheet in the page instead of a modal. */
  embedded?: boolean;
  onDismiss: () => void;
  onSave: (mode: GroupDefaultSplitMode, weights: Record<string, number>) => void;
}

function displayName(participant: Participant): string {
  return participant.full_name
    || participant.email?.split("@")[0]
    || "Unknown";
}

function draftWeights(
  participants: Participant[],
  stored: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const participant of participants) {
    next[participant.id] = clampShareCount(stored[participant.id] ?? 1);
  }
  return next;
}

export const GroupDefaultSplitSheet: React.FC<GroupDefaultSplitSheetProps> = ({
  visible,
  groupName,
  participants,
  mode,
  weights,
  saving = false,
  error,
  embedded = false,
  onDismiss,
  onSave,
}) => {
  const theme = useTheme();
  const [draftMode, setDraftMode] = useState<GroupDefaultSplitMode>(mode);
  const [draftShares, setDraftShares] = useState<Record<string, number>>(() =>
    draftWeights(participants, weights)
  );
  const seedRef = useRef("");
  const participantKey = useMemo(
    () => participants.map((participant) => participant.id).join("\0"),
    [participants],
  );
  const weightsKey = JSON.stringify(weights ?? {});

  useEffect(() => {
    if (!visible && !embedded) {
      seedRef.current = "";
      return;
    }
    const seed = `${mode}|${participantKey}|${weightsKey}`;
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    setDraftMode(mode);
    setDraftShares(draftWeights(participants, weights));
  }, [embedded, mode, participantKey, participants, visible, weights, weightsKey]);

  if (!visible && !embedded) return null;

  const body = (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.frame}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={theme.colors.onSurface}
            accessibilityLabel="Back"
            onPress={onDismiss}
            testID="default-split-back"
          />
          <Text variant="titleLarge" style={styles.title}>
            Default split
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {groupName
              ? `New expenses in ${groupName} start with this split. Past expenses stay as they were.`
              : "New expenses start with this split. Past expenses stay as they were."}
          </Text>

          <ModeCard
            title="Equal"
            description="Everyone counts as 1."
            selected={draftMode === "equal"}
            disabled={saving}
            testID="default-split-mode-equal"
            onPress={() => setDraftMode("equal")}
          />
          <ModeCard
            title="Shares"
            description="Set a share for each person. A couple can count as 2."
            selected={draftMode === "weights"}
            disabled={saving}
            testID="default-split-mode-weights"
            onPress={() => setDraftMode("weights")}
          />

          {draftMode === "weights" ? (
            <Surface
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
              elevation={0}
            >
              {participants.length === 0 ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Add people to this group before setting shares.
                </Text>
              ) : (
                participants.map((participant) => {
                  const name = displayName(participant);
                  const shareCount = clampShareCount(draftShares[participant.id] ?? 1);
                  return (
                    <View key={participant.id} style={styles.weightRow}>
                      <View style={styles.weightCopy}>
                        <Text variant="bodyLarge" numberOfLines={1}>{name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {shareCount === 1 ? "1 share" : `${shareCount} shares`}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <IconButton
                          icon="minus"
                          size={20}
                          disabled={saving || shareCount <= 1}
                          onPress={() => {
                            setDraftShares((current) => ({
                              ...current,
                              [participant.id]: clampShareCount(shareCount - 1),
                            }));
                          }}
                          accessibilityLabel={`Fewer shares for ${name}`}
                          testID={`default-split-minus-${participant.id}`}
                        />
                        <Text
                          variant="titleMedium"
                          accessibilityLabel={`${name}, ${shareCount} shares`}
                          style={styles.shareCount}
                        >
                          {shareCount}
                        </Text>
                        <IconButton
                          icon="plus"
                          size={20}
                          disabled={saving || shareCount >= MAX_SHARE_COUNT}
                          onPress={() => {
                            setDraftShares((current) => ({
                              ...current,
                              [participant.id]: clampShareCount(shareCount + 1),
                            }));
                          }}
                          accessibilityLabel={`More shares for ${name}`}
                          testID={`default-split-plus-${participant.id}`}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </Surface>
          ) : null}

          {error ? (
            <Text variant="bodySmall" accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button
            mode="contained"
            loading={saving}
            disabled={saving}
            onPress={() => onSave(draftMode, draftWeights(participants, draftShares))}
            testID="default-split-save"
          >
            Save
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      {body}
    </Modal>
  );
};

function ModeCard({
  title,
  description,
  selected,
  disabled,
  testID,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  testID: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Surface
      style={[
        styles.card,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
        },
      ]}
      elevation={0}
    >
      <TouchableRipple
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        testID={testID}
      >
        <View style={styles.modeCopy}>
          <Text variant="titleSmall" style={{ fontWeight: "700", color: theme.colors.onSurface }}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {description}
          </Text>
        </View>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: WEB_MAX_WIDTH,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    minHeight: 64,
  },
  title: {
    flex: 1,
    fontWeight: "700",
    marginHorizontal: 8,
  },
  body: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  modeCopy: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
    minHeight: 64,
    gap: 8,
  },
  weightCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
  },
  shareCount: {
    minWidth: 24,
    textAlign: "center",
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
