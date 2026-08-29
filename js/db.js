// Small wrapper around Supabase calls, so the page-specific scripts
// stay readable. Every function throws on error — callers wrap calls
// in try/catch and show a message.

function publicUrlFor(path) {
  if (!path) return null;
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- profiles / login ----------
// No real password — just a username plus a short "secret word" the
// person picks when their username is first created. Typing the same
// username + secret word on any device gets you back into the same
// account. This is a friendly checkpoint, not real security.

async function getProfileByUsername(username) {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createProfile(username, secretWord) {
  const { data, error } = await sb
    .from("profiles")
    .insert({ username, secret_word: secretWord })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function setSecretWord(profileId, secretWord) {
  const { data, error } = await sb
    .from("profiles")
    .update({ secret_word: secretWord })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- board ----------

async function listBoardImages(userId) {
  const { data, error } = await sb
    .from("board_images")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

async function uploadImageFile(file, folder) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

async function uploadImageBlob(blob, folder) {
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw error;
  return path;
}

async function addBoardImageFromFile(userId, file) {
  const path = await uploadImageFile(file, `${userId}/board`);
  return addBoardImageFromPath(userId, path);
}

async function addBoardImageFromPath(userId, path) {
  const { data: existing, error: e1 } = await sb
    .from("board_images")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const nextPosition = existing.length ? existing[0].position + 1 : 0;

  const { data, error } = await sb
    .from("board_images")
    .insert({ user_id: userId, image_path: path, position: nextPosition })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteBoardImage(image) {
  await sb.storage.from(STORAGE_BUCKET).remove([image.image_path]);
  const { error } = await sb.from("board_images").delete().eq("id", image.id);
  if (error) throw error;
}

async function reorderBoardImages(orderedIds) {
  // orderedIds: array of image ids in their new top-to-bottom order
  const updates = orderedIds.map((id, index) =>
    sb.from("board_images").update({ position: index }).eq("id", id)
  );
  await Promise.all(updates);
}

// ---------- sets ----------

const FINGER_KEYS = [
  "left_thumb", "left_index", "left_middle", "left_ring", "left_pinky",
  "right_thumb", "right_index", "right_middle", "right_ring", "right_pinky",
];

const FINGER_LABELS = {
  left_thumb: "Left Thumb", left_index: "Left Index", left_middle: "Left Middle",
  left_ring: "Left Ring", left_pinky: "Left Pinky",
  right_thumb: "Right Thumb", right_index: "Right Index", right_middle: "Right Middle",
  right_ring: "Right Ring", right_pinky: "Right Pinky",
};

async function listSets(userId) {
  const { data, error } = await sb
    .from("sets")
    .select("*, set_slots(*)")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getSet(setId) {
  const { data, error } = await sb
    .from("sets")
    .select("*, set_slots(*)")
    .eq("id", setId)
    .single();
  if (error) throw error;
  return data;
}

async function createSet(userId, name, notes) {
  const { data: set, error } = await sb
    .from("sets")
    .insert({ user_id: userId, name, notes: notes || "" })
    .select()
    .single();
  if (error) throw error;

  const slotRows = FINGER_KEYS.map((key) => ({ set_id: set.id, finger_key: key }));
  const { error: slotError } = await sb.from("set_slots").insert(slotRows);
  if (slotError) throw slotError;

  return set;
}

async function updateSet(setId, fields) {
  const { error } = await sb
    .from("sets")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", setId);
  if (error) throw error;
}

async function toggleFavorite(setId, isFavorite) {
  await updateSet(setId, { is_favorite: isFavorite });
}

async function deleteSet(set) {
  const paths = (set.set_slots || []).map((s) => s.image_path).filter(Boolean);
  if (paths.length) await sb.storage.from(STORAGE_BUCKET).remove(paths);
  const { error } = await sb.from("sets").delete().eq("id", set.id);
  if (error) throw error;
}

async function duplicateSet(set, newName) {
  const newSet = await createSet(set.user_id, newName, set.notes);
  // copy over notes per finger (not the images — keeps duplication simple
  // and avoids doubling up storage for a "starting point" copy)
  const updates = (set.set_slots || []).map((slot) =>
    sb.from("set_slots").update({ note: slot.note }).eq("set_id", newSet.id).eq("finger_key", slot.finger_key)
  );
  await Promise.all(updates);
  return newSet;
}

async function updateSlot(setId, fingerKey, fields) {
  const { error } = await sb
    .from("set_slots")
    .update(fields)
    .eq("set_id", setId)
    .eq("finger_key", fingerKey);
  if (error) throw error;
  await updateSet(setId, {}); // bump updated_at
}

async function setSlotImageFromFile(userId, setId, fingerKey, file) {
  const path = await uploadImageFile(file, `${userId}/slots`);
  await updateSlot(setId, fingerKey, { image_path: path });
  return path;
}

async function setSlotImageFromBlob(userId, setId, fingerKey, blob) {
  const path = await uploadImageBlob(blob, `${userId}/slots`);
  await updateSlot(setId, fingerKey, { image_path: path });
  return path;
}
