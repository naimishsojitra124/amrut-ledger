import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/use-auth";

import {
  useArchiveUserMutation,
  useChangeUserPasswordMutation,
  useChangeUserRoleMutation,
  useCreateUserMutation,
  useRestoreUserMutation,
  useUpdateUserMutation,
  useUserQuery,
  type UserRole,
  type UserStatus,
} from "@/services/user.service";

import { useModalStore } from "@/store/modal.store";
import { toast } from "sonner";

const ROLE_META: Record<
  UserRole,
  {
    label: string;
    description: string;
  }
> = {
  owner: {
    label: "Owner",
    description: "Full access to all features, settings and data.",
  },
  manager: {
    label: "Manager",
    description: "Can manage customers, bills, payments and reports.",
  },
  employee: {
    label: "Employee",
    description: "Can add entries, view customers and collect payments.",
  },
};

export default function UserFormModal() {
  const { isOwner } = useAuth();

  const activeModal = useModalStore((state) => state.activeModal);
  const settingsForm = useModalStore((state) => state.settingsForm);
  const closeModal = useModalStore((state) => state.closeModal);

  const id = settingsForm?.id ?? null;
  const isOpen = activeModal === "userForm";
  const isCreate = !id;

  const userQuery = useUserQuery(id, {
    enabled: isOpen && Boolean(id),
  });

  const createUserMutation = useCreateUserMutation();

  const updateUserMutation = useUpdateUserMutation();

  const changePasswordMutation = useChangeUserPasswordMutation();

  const changeRoleMutation = useChangeUserRoleMutation();

  const archiveUserMutation = useArchiveUserMutation();

  const restoreUserMutation = useRestoreUserMutation();

  const user = userQuery.data ?? null;

  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("owner");
  const [status, setStatus] = useState<UserStatus>("active");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (isCreate) {
      setFullName("");
      setMobileNumber("");
      setEmail("");
      setRole("owner");
      setStatus("active");
      setNewPassword("");
      setConfirmPassword("");
      return;
    }

    if (!user) {
      return;
    }

    setFullName(user.fullName);
    setMobileNumber(user.mobileNumber);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setNewPassword("");
    setConfirmPassword("");
  }, [isOpen, isCreate, id, user]);

  const isBusy =
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    changePasswordMutation.isPending ||
    changeRoleMutation.isPending ||
    archiveUserMutation.isPending ||
    restoreUserMutation.isPending;

  const isLoadingUser = !isCreate && isOpen && userQuery.isLoading;

  function handleClose() {
    if (isBusy) {
      return;
    }

    closeModal();
  }

  async function handleSubmit() {
    const normalizedFullName = fullName.trim();

    const normalizedMobileNumber = mobileNumber.trim();

    const normalizedEmail = email.trim().toLowerCase();

    const password = newPassword.trim();
    const confirmation = confirmPassword.trim();

    if (!normalizedFullName) {
      toast.error("Full name is required");
      return;
    }

    if (!/^\d{10}$/.test(normalizedMobileNumber)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }

    if (!normalizedEmail) {
      toast.error("Email is required");
      return;
    }

    if (isCreate) {
      if (!password) {
        toast.error("Password is required");
        return;
      }

      if (password !== confirmation) {
        toast.error("Passwords do not match");
        return;
      }

      try {
        await createUserMutation.mutateAsync({
          fullName: normalizedFullName,
          mobileNumber: normalizedMobileNumber,
          email: normalizedEmail,
          password,
          role,
        });

        toast.success("User created");
        closeModal();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create user",
        );
      }

      return;
    }

    if (!user) {
      return;
    }

    if (password || confirmation) {
      if (!password || !confirmation) {
        toast.error("Enter and confirm the new password");
        return;
      }

      if (password !== confirmation) {
        toast.error("Passwords do not match");
        return;
      }
    }

    const detailsChanged =
      normalizedFullName !== user.fullName ||
      normalizedMobileNumber !== user.mobileNumber ||
      normalizedEmail !== user.email;

    const roleChanged = role !== user.role;

    const statusChanged = status !== user.status;

    const passwordChanged = Boolean(password);

    if (!detailsChanged && !roleChanged && !statusChanged && !passwordChanged) {
      toast.info("No changes to save");
      return;
    }

    try {
      if (detailsChanged) {
        await updateUserMutation.mutateAsync({
          id: user.id,
          payload: {
            fullName: normalizedFullName,
            mobileNumber: normalizedMobileNumber,
            email: normalizedEmail,
          },
        });
      }

      if (roleChanged) {
        await changeRoleMutation.mutateAsync({
          id: user.id,
          payload: {
            role,
          },
        });
      }

      if (statusChanged) {
        if (status === "inactive") {
          await archiveUserMutation.mutateAsync(user.id);
        } else {
          await restoreUserMutation.mutateAsync(user.id);
        }
      }

      if (passwordChanged) {
        await changePasswordMutation.mutateAsync({
          id: user.id,
          payload: {
            password,
          },
        });
      }

      toast.success("User updated");
      closeModal();
    } catch {
      // Already surfaced by the global error handler.
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base sm:text-lg">
            {isCreate ? "Create User" : "Edit User"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-5 px-2 py-3 sm:p-4">
            {isLoadingUser ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500">
                Loading user details...
              </div>
            ) : userQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {(userQuery.error as Error)?.message ||
                  "Failed to load user details."}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>

                    <Input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter full name"
                      className="h-11"
                      disabled={isBusy}
                      autoComplete="name"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>

                    <Input
                      value={mobileNumber}
                      onChange={(event) => setMobileNumber(event.target.value)}
                      placeholder="10-digit mobile number"
                      className="h-11"
                      inputMode="numeric"
                      maxLength={10}
                      disabled={isBusy}
                      autoComplete="tel"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Email <span className="text-red-500">*</span>
                    </label>

                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      placeholder="Enter email address"
                      className="h-11"
                      disabled={isBusy}
                      autoComplete="email"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Role <span className="text-red-500">*</span>
                    </label>

                    <Select
                      value={role}
                      onValueChange={(value) => setRole(value as UserRole)}
                      disabled={!isOwner || isBusy}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>

                      <SelectContent position="popper">
                        <SelectItem value="owner">Owner</SelectItem>

                        <SelectItem value="manager">Manager</SelectItem>

                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>

                    {!isOwner && (
                      <p className="text-xs text-neutral-500">
                        Only the owner can change roles.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Status <span className="text-red-500">*</span>
                    </label>

                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as UserStatus)}
                      disabled={isCreate || isBusy}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>

                      <SelectContent position="popper">
                        <SelectItem value="active">Active</SelectItem>

                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>

                    {isCreate && (
                      <p className="text-xs text-neutral-500">
                        New users are created as active.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-neutral-50 p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {isCreate ? "Set Password" : "Change Password"}

                      <span className="ml-1 font-normal text-neutral-500">
                        {isCreate ? "(Required)" : "(Optional)"}
                      </span>
                    </h3>

                    {!isCreate && (
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        Leave both fields blank to keep the existing password.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">
                        New Password{" "}
                        {isCreate && <span className="text-red-500">*</span>}
                      </label>

                      <Input
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        type="password"
                        placeholder="Enter new password"
                        className="h-11"
                        disabled={isBusy}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">
                        Confirm Password{" "}
                        {isCreate && <span className="text-red-500">*</span>}
                      </label>

                      <Input
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        type="password"
                        placeholder="Confirm password"
                        className="h-11"
                        disabled={isBusy}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                {!isCreate && user && (
                  <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-neutral-500">Created On</p>

                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-neutral-500">Last Login</p>

                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-neutral-500">Current Role</p>

                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {ROLE_META[user.role].label}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isBusy || isLoadingUser}
            className="w-full sm:w-auto"
          >
            {isCreate ? "Create User" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
