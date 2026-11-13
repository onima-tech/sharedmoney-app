import React from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Divider,
  IconButton,
  Menu,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { Participant } from "../types";
import { formatDate } from "../utils/date";
import { canRemovePerson, memberRowShowsMenu } from "../utils/peoplePicker";
import { styles } from "./MembersList.styles";

interface MembersListProps {
  people: Participant[];
  currentUserId?: string;
  /** If true, the current user can remove people from this group. */
  canManageMembers: boolean;
  removingMemberId: string | null;
  workingParticipantId?: string | null;
  onRemove: (participant: Participant) => void;
  onInvite?: (participant: Participant) => void;
  onConnect?: (participant: Participant) => void;
  onBlock?: (participant: Participant) => void;
}

export const MembersList: React.FC<MembersListProps> = ({
  people,
  currentUserId,
  canManageMembers,
  removingMemberId,
  workingParticipantId,
  onRemove,
  onInvite,
  onConnect,
  onBlock,
}) => {
  const theme = useTheme();
  const [menuParticipantId, setMenuParticipantId] = React.useState<string | null>(null);
  const sortedPeople = React.useMemo(() => {
    return [...people].sort((a, b) => {
      if (a.type === 'former' && b.type !== 'former') return 1;
      if (a.type !== 'former' && b.type === 'former') return -1;
      return 0;
    });
  }, [people]);

  const rows = React.useMemo(() => {
    return sortedPeople.map((person) => {
      const personName =
        person.full_name ||
        person.email ||
        `Person ${person.id.substring(0, 8)}`;
      const isCurrentUser = person.user_id === currentUserId;
      const isActive = person.type !== "former";
      const canRemove = canRemovePerson(person, {
        canManageMembers,
        currentUserId,
      });
      const isRemoving = removingMemberId === person.id;
      const isWorking = workingParticipantId === person.id || isRemoving;
      const canInviteOrConnect = canManageMembers && !person.user_id && !!person.email && isActive;
      const canBlock = !!onBlock && !!person.user_id && !isCurrentUser;
      const hasMenuActions = memberRowShowsMenu(person, {
        canManageMembers,
        currentUserId,
        canBlock: !!onBlock,
      });
      const dateLabel = person.joined_at || person.created_at;
      return {
        person,
        personName,
        isCurrentUser,
        isActive,
        canRemove,
        isRemoving,
        isWorking,
        hasMenuActions,
        canInviteOrConnect,
        canBlock,
        detail: person.email || (dateLabel ? `Joined ${formatDate(dateLabel)}` : ""),
      };
    });
  }, [
    sortedPeople,
    canManageMembers,
    currentUserId,
    removingMemberId,
    workingParticipantId,
    onBlock,
  ]);

  const reserveRemove = rows.some((row) => row.canRemove || row.isRemoving);
  const reserveMenu = rows.some((row) => row.hasMenuActions || (row.isWorking && !row.isRemoving));

  if (people.length === 0) {
    return (
      <Text
        variant="bodyMedium"
        style={{
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        }}
      >
        No people yet
      </Text>
    );
  }

  const getInitials = (name: string) => {
    if (name.includes(" ")) {
      const names = name.trim().split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Surface
      elevation={0}
      style={{ backgroundColor: theme.colors.surface, borderRadius: 12 }}
    >
      {rows.map((row, index) => {
        const {
          person,
          personName,
          isCurrentUser,
          isActive,
          canRemove,
          isRemoving,
          isWorking,
          hasMenuActions,
          canInviteOrConnect,
          canBlock,
          detail,
        } = row;

        return (
          <React.Fragment key={person.id}>
            <View
              style={[
                styles.memberContent,
                isRemoving && styles.memberCardRemoving,
                { paddingHorizontal: 16, paddingVertical: 12 },
              ]}
            >
              <Avatar.Text
                size={40}
                label={getInitials(personName)}
                style={{
                  backgroundColor: isActive
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                  marginRight: 16,
                  opacity: isWorking ? 0.6 : 1,
                  flexShrink: 0,
                }}
                color={
                  isActive
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant
                }
              />
              <View style={styles.memberLeft}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.memberName,
                      isRemoving && { opacity: 0.6 },
                      {},
                    ]}
                  >
                    {personName}{isCurrentUser ? " (You)" : ""}
                    {!isActive ? " (Former)" : ""}
                  </Text>
                </View>
                {detail ? (
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      opacity: isRemoving ? 0.6 : 1,
                    }}
                  >
                    {detail}
                  </Text>
                ) : null}
              </View>
              <View style={styles.memberRight}>
                {reserveRemove ? (
                  <View style={styles.actionSlot}>
                    {isRemoving ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : canRemove ? (
                      <IconButton
                        icon="delete-outline"
                        size={24}
                        iconColor={theme.colors.error}
                        onPress={() => onRemove(person)}
                        style={styles.removeMemberButton}
                        disabled={removingMemberId !== null}
                      />
                    ) : null}
                  </View>
                ) : null}
                {reserveMenu ? (
                  <View style={styles.actionSlot}>
                    {hasMenuActions && !isWorking ? (
                      <Menu
                        visible={menuParticipantId === person.id}
                        onDismiss={() => setMenuParticipantId(null)}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            size={24}
                            accessibilityLabel={`Actions for ${personName}`}
                            onPress={() => setMenuParticipantId(person.id)}
                            style={styles.removeMemberButton}
                            disabled={!!workingParticipantId}
                          />
                        }
                      >
                          {canInviteOrConnect ? (
                            <>
                              <Menu.Item
                                title="Invite to SharedMoney"
                                leadingIcon="email-outline"
                                onPress={() => {
                                  setMenuParticipantId(null);
                                  onInvite?.(person);
                                }}
                              />
                              <Menu.Item
                                title="Connect account"
                                leadingIcon="account-check-outline"
                                onPress={() => {
                                  setMenuParticipantId(null);
                                  onConnect?.(person);
                                }}
                              />
                            </>
                          ) : null}
                          {canBlock ? (
                            <Menu.Item
                              title={`Block ${personName} everywhere`}
                              leadingIcon="account-cancel-outline"
                              onPress={() => {
                                setMenuParticipantId(null);
                                onBlock?.(person);
                              }}
                            />
                          ) : null}
                        </Menu>
                    ) : isWorking && !isRemoving ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
            {index < rows.length - 1 && <Divider />}
          </React.Fragment>
        );
      })}
    </Surface>
  );
};
