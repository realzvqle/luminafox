/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/PushSubscriptionOptions.h"

#include "MainThreadUtils.h"
#include "mozilla/dom/PushSubscriptionOptionsBinding.h"
#include "mozilla/dom/TypedArray.h"
#include "mozilla/ErrorResult.h"
#include "mozilla/HoldDropJSObjects.h"
#include "nsIGlobalObject.h"
#include "nsWrapperCache.h"

namespace mozilla::dom {

PushSubscriptionOptions::PushSubscriptionOptions(
    nsIGlobalObject* aGlobal, nsTArray<uint8_t>&& aRawAppServerKey)
    : mGlobal(aGlobal),
      mRawAppServerKey(std::move(aRawAppServerKey)),
      mAppServerKey(nullptr) {
  // There's only one global on a worker, so we don't need to pass a global
  // object to the constructor.
  MOZ_ASSERT_IF(NS_IsMainThread(), mGlobal);
  mozilla::HoldJSObjects(this);
}

PushSubscriptionOptions::~PushSubscriptionOptions() {
  mozilla::DropJSObjects(this);
}

NS_IMPL_CYCLE_COLLECTION_WRAPPERCACHE_WITH_JS_MEMBERS(PushSubscriptionOptions,
                                                      (mGlobal),
                                                      (mAppServerKey))

NS_IMPL_CYCLE_COLLECTING_ADDREF(PushSubscriptionOptions)
NS_IMPL_CYCLE_COLLECTING_RELEASE(PushSubscriptionOptions)

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(PushSubscriptionOptions)
  NS_WRAPPERCACHE_INTERFACE_MAP_ENTRY
  NS_INTERFACE_MAP_ENTRY(nsISupports)
NS_INTERFACE_MAP_END

JSObject* PushSubscriptionOptions::WrapObject(
    JSContext* aCx, JS::Handle<JSObject*> aGivenProto) {
  return PushSubscriptionOptions_Binding::Wrap(aCx, this, aGivenProto);
}

void PushSubscriptionOptions::GetApplicationServerKey(
    JSContext* aCx, JS::MutableHandle<JSObject*> aKey, ErrorResult& aRv) {
  if (!mRawAppServerKey.IsEmpty() && !mAppServerKey) {
    mAppServerKey = ArrayBuffer::Create(aCx, mRawAppServerKey, aRv);
    if (aRv.Failed()) {
      return;
    }
  }
  aKey.set(mAppServerKey);
}

}  // namespace mozilla::dom
