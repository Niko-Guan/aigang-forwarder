pragma solidity ^0.4.2;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/BatteryInsurancePolicy.sol";

contract TestBatteryInsurancePolicy {

  function testMaxPayoutShouldBeSet() {
    BatteryInsurancePolicy batteryInsurancePolicy = BatteryInsurancePolicy(DeployedAddresses.BatteryInsurancePolicy());

    uint expected = 10000000000000000;

    Assert.equal(batteryInsurancePolicy.maxPayout(), expected, "MaxPayout should be set to 0.01 ETH initially");
  }
}
