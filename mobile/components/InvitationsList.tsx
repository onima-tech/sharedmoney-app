import React from "react";
import { View } from "react-native";
import {
    ActivityIndicator,
    Avatar,
    Divider,
    IconButton,
    Surface,
    Text,
    useTheme,
} from "react-native-paper";
import { GroupInvitation } from "../types";
import { formatDate } from "../utils/date";
import { styles } from "./InvitationsList.styles";

interface InvitationsListProps {
  invitations: GroupInvitation[];
  loading: boolean;
  canManageInvites: boolean;
  /** Keep cancel in the remove column when member rows also show an overflow menu. */
  reserveMenuColumn?: boolean;
  cancellingInvitationId: string | null;
  onCancel: (invitationId: string) => void;
}

export const InvitationsList: React.FC<InvitationsListProps> = ({
  invitations,
  loading,
  canManageInvites,
  reserveMenuColumn = false,
  cancellingInvitationId,
  onCancel,
}) => {
  const theme = useTheme();

  if (invitations.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
    );
  }

  const markFor = (invitation: GroupInvitation):
    | { kind: "initials"; label: string }
    | { kind: "icon"; icon: "phone" | "link-variant" } => {
    if (invitation.email) {
      return { kind: "initials", label: invitation.email.substring(0, 2).toUpperCase() };
    }
    if (invitation.phone) return { kind: "icon", icon: "phone" };
    return { kind: "icon", icon: "link-variant" };
  };

  return (
    <Surface elevation={0} style={{ backgroundColor: theme.colors.surface, borderRadius: 12, marginTop: 8 }}>
      <Text variant="titleSmall" style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, color: theme.colors.onSurfaceVariant }}>
        Pending Invitations
      </Text>
      {invitations.map((invitation, index) => {
        const isCancelling = cancellingInvitationId === invitation.id;
        const expiresDate = new Date(invitation.expires_at);
        const isExpired = expiresDate < new Date();
        const mark = markFor(invitation);
        const identified = !!(invitation.email || invitation.phone);
        const avatarStyle = {
          backgroundColor: identified
            ? theme.colors.surfaceVariant
            : theme.colors.primaryContainer,
          marginRight: 16,
          flexShrink: 0,
        };
        const foreground = identified
          ? theme.colors.onSurfaceVariant
          : theme.colors.onPrimaryContainer;

        return (
          <React.Fragment key={invitation.id}>
            <View
              style={[
                styles.memberContent,
                isCancelling && styles.memberCardRemoving,
                isExpired && { opacity: 0.6 },
                { paddingHorizontal: 16, paddingVertical: 12 }
              ]}
            >
              {mark.kind === "initials" ? (
                <Avatar.Text
                  size={40}
                  label={mark.label}
                  style={avatarStyle}
                  color={foreground}
                />
              ) : (
                <Avatar.Icon
                  size={40}
                  icon={mark.icon}
                  style={avatarStyle}
                  color={foreground}
                />
              )}
              <View style={styles.memberLeft}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.memberName,
                    isCancelling && { opacity: 0.6 },
                  ]}
                >
                  {invitation.email ||
                    invitation.phone ||
                    (() => {
                      const remaining = Math.max(
                        (invitation.max_uses ?? 1) - (invitation.uses_count ?? 0),
                        0
                      );
                      return `Invite link (${remaining} ${
                        remaining === 1 ? "use" : "uses"
                      } left)`;
                    })()}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    opacity: isCancelling ? 0.6 : 1,
                  }}
                >
                  {isExpired
                    ? "Expired"
                    : `Expires ${formatDate(invitation.expires_at)}`}
                </Text>
              </View>
              <View style={styles.memberRight}>
                {canManageInvites ? (
                  <View style={styles.actionSlot}>
                    {isCancelling ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : (
                      <IconButton
                        icon="close-circle-outline"
                        size={24}
                        iconColor={theme.colors.error}
                        onPress={() => onCancel(invitation.id)}
                        style={styles.removeMemberButton}
                        disabled={cancellingInvitationId !== null}
                      />
                    )}
                  </View>
                ) : null}
                {canManageInvites && reserveMenuColumn ? <View style={styles.actionSlot} /> : null}
              </View>
            </View>
            {index < invitations.length - 1 && <Divider />}
          </React.Fragment>
        );
      })}
    </Surface>
  );
};
