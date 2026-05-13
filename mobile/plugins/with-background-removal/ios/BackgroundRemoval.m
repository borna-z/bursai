//
//  BackgroundRemoval.m — RCT bridge for the Swift Vision wrapper.
//
//  Wave R-B. Exposes the `BackgroundRemoval` Swift class to the React
//  Native bridge so `NativeModules.BackgroundRemoval` is reachable from
//  JS.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BackgroundRemoval, NSObject)

RCT_EXTERN_METHOD(prepare:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(maskImage:(NSString *)uri
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
