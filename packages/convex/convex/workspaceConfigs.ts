import { v } from "convex/values";
import { resolveTeamIdLoose } from "../_shared/team";
import { authMutation, authQuery } from "./users/utils";

const normalizeProjectFullName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("projectFullName is required");
  }
  return trimmed;
};

const normalizeScript = (
  script: string | undefined,
): string | undefined => {
  if (script === undefined) {
    return undefined;
  }
  const trimmed = script.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const get = authQuery({
  args: {
    teamSlugOrId: v.string(),
    projectFullName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const projectFullName = normalizeProjectFullName(args.projectFullName);

    if (!userId) {
      throw new Error("Authentication required");
    }

    // Try to get from the unified local table (which is now the source of truth)
    const config = await ctx.db
      .query("localWorkspaceConfigs")
      .withIndex("by_team_user_repo", (q) =>
        q
          .eq("teamId", teamId)
          .eq("userId", userId)
          .eq("projectFullName", projectFullName),
      )
      .first();

    // If not found, try the cloud table for backward compatibility
    if (!config) {
      const cloudConfig = await ctx.db
        .query("cloudRepoConfigs")
        .withIndex("by_team_user_repo", (q) =>
          q
            .eq("teamId", teamId)
            .eq("userId", userId)
            .eq("projectFullName", projectFullName),
        )
        .first();
      return cloudConfig ?? null;
    }

    return config;
  },
});

export const upsert = authMutation({
  args: {
    teamSlugOrId: v.string(),
    projectFullName: v.string(),
    maintenanceScript: v.optional(v.string()),
    dataVaultKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const teamId = await resolveTeamIdLoose(ctx, args.teamSlugOrId);
    const projectFullName = normalizeProjectFullName(args.projectFullName);
    const maintenanceScript = normalizeScript(args.maintenanceScript);
    const now = Date.now();

    if (!userId) {
      throw new Error("Authentication required");
    }

    // Check both tables for existing config
    const existingLocal = await ctx.db
      .query("localWorkspaceConfigs")
      .withIndex("by_team_user_repo", (q) =>
        q
          .eq("teamId", teamId)
          .eq("userId", userId)
          .eq("projectFullName", projectFullName),
      )
      .first();

    const existingCloud = await ctx.db
      .query("cloudRepoConfigs")
      .withIndex("by_team_user_repo", (q) =>
        q
          .eq("teamId", teamId)
          .eq("userId", userId)
          .eq("projectFullName", projectFullName),
      )
      .first();

    // If we have a config in the local table, update it
    if (existingLocal) {
      await ctx.db.patch(existingLocal._id, {
        maintenanceScript,
        dataVaultKey: args.dataVaultKey ?? existingLocal.dataVaultKey,
        updatedAt: now,
      });

      // Also update cloud config if it exists, to keep them in sync during migration
      if (existingCloud) {
        await ctx.db.patch(existingCloud._id, {
          maintenanceScript,
          dataVaultKey: args.dataVaultKey ?? existingCloud.dataVaultKey,
          updatedAt: now,
        });
      }

      return existingLocal._id;
    }

    // If we only have cloud config, migrate it to local table
    if (existingCloud) {
      const id = await ctx.db.insert("localWorkspaceConfigs", {
        projectFullName,
        maintenanceScript,
        dataVaultKey: args.dataVaultKey ?? existingCloud.dataVaultKey,
        createdAt: now,
        updatedAt: now,
        userId,
        teamId,
      });

      // Update the cloud config too for backward compatibility
      await ctx.db.patch(existingCloud._id, {
        maintenanceScript,
        dataVaultKey: args.dataVaultKey ?? existingCloud.dataVaultKey,
        updatedAt: now,
      });

      return id;
    }

    // No existing config, create new in local table (source of truth)
    const id = await ctx.db.insert("localWorkspaceConfigs", {
      projectFullName,
      maintenanceScript,
      dataVaultKey: args.dataVaultKey,
      createdAt: now,
      updatedAt: now,
      userId,
      teamId,
    });

    return id;
  },
});
