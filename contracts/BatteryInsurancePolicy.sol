pragma solidity ^0.4.14;

import "./PolicyInvestable.sol";
import "./SafeMath.sol";

contract BatteryInsurancePolicy is PolicyInvestable { 

  using SafeMath for uint256;
  // Investment data 
  mapping (address => uint) public investors;
  uint public totalInvestorsCount;
  uint public totalInvestedAmount;
  
  uint public totalInsurers;
  uint public totalClaimsPaid;
  
  uint128 public investmentsLimit;
  uint32 public investmentsDeadlineTimeStamp;
  
  uint8 constant decimalPrecision = 8;
    
  mapping (address => DividendLine[]) private payedDividends;
  uint public payedDividendsAmount;

 
  // Insurance data
  uint public policiesLimit;
  mapping (address => PolicyData) insurancePolicies;
  mapping (string => mapping(string => uint) ) insuranceParameters;
  uint public basePremium;
  uint public maxPayout;
  uint loading;
  uint public writtenPremiumAmount;
   uint32 public lastPolicyDate;


  // Owner is used to confirm policies and claims which came via our server
  address owner = 0xca35b7d915458ef540ade6068dfe2f44e8fa733c;


  event Insured(string deviceName, uint insurancePrice);
  event Claimed(uint payout); 
  event DividendsPayed(uint payout); 

  struct DividendLine{
      uint amount;
      uint32 transferDate;
  }

  struct PolicyData {
        DeviceData device;
        uint endDateTimestamp;
        uint nextPaymentTimestamp;
        uint monthlyPayment;
        uint maxPayout;
        uint totalPrice;
        string region;
        bool claimed;
        bool confirmed;
  }

  struct DeviceData {
    string itemId;
    string deviceBrand;
    string deviceYear;
    string batteryWearLevel;
  }

  function BatteryInsurancePolicy() payable {
    // Initial funds
    investors[msg.sender] = investors[msg.sender] + msg.value;
    totalInvestorsCount++;
    totalInvestedAmount = totalInvestedAmount + msg.value;
    Invested(msg.value);

    setInitialInsuranceParameters();
  }

  function setInitialInsuranceParameters() internal {
    // Device brand
    insuranceParameters['deviceBrand']['apple'] = 100;
    insuranceParameters['deviceBrand']['samsung'] = 110;
    insuranceParameters['deviceBrand']['default'] = 120;

    // Device year
    insuranceParameters['deviceYear']['2014'] = 120;
    insuranceParameters['deviceYear']['2015'] = 110;
    insuranceParameters['deviceYear']['2016'] = 100;
    insuranceParameters['deviceYear']['2017'] = 100;
    insuranceParameters['deviceYear']['default'] = 140;

    // Battery wear level upper than
    insuranceParameters['wearLevel']['50'] = 150;
    insuranceParameters['wearLevel']['60'] = 140;
    insuranceParameters['wearLevel']['70'] = 120;
    insuranceParameters['wearLevel']['80'] = 110;
    insuranceParameters['wearLevel']['90'] = 100;

    // Region
    insuranceParameters['region']['usa'] = 100;
    insuranceParameters['region']['europe'] = 100;
    insuranceParameters['region']['africa'] = 120;
    insuranceParameters['region']['default'] = 130;

    // Base premium (0.001 ETH)
    basePremium = 1000000000000000;

    // Max payout (0.01 ETH)
    maxPayout = 10000000000000000;
    
    investmentsLimit = 1000000000000000000000; //1000 ETH
    investmentsDeadlineTimeStamp = uint32(now) + 60 days;

    policiesLimit = 10000;

    // Loading percentage (expenses, etc)
    loading = 50;
  }

  // fallback functon not to take ethers
  function() payable { 
    throw;
  }

  

  // policy part
  // More parameters should be included
  function policyPrice(string deviceBrand, string deviceYear, string wearLevel, string region) constant returns(uint price) {
    // set defaults
    uint deviceBrandMultiplier = insuranceParameters['deviceBrand']['default'];
    uint deviceYearMultiplier = insuranceParameters['deviceYear']['default'];
    uint batteryWearLevelMultiplier = insuranceParameters['wearLevel']['default'];
    uint regionMultiplier = insuranceParameters['region']['default'];

    if(insuranceParameters['deviceBrand'][deviceBrand] != 0) {
      deviceBrandMultiplier = insuranceParameters['deviceBrand'][deviceBrand];
    }
    if(insuranceParameters['deviceYear'][deviceYear] != 0) {
      deviceYearMultiplier = insuranceParameters['deviceYear'][deviceYear];
    }
    if(insuranceParameters['wearLevel'][wearLevel] != 0) {
      batteryWearLevelMultiplier = insuranceParameters['wearLevel'][wearLevel];
    }
    if(insuranceParameters['region'][region] != 0) {
      deviceBrandMultiplier = insuranceParameters['region'][region];
    }

    // / 100 is due to Solidity not supporting doubles
    uint riskPremium = basePremium * deviceBrandMultiplier / 100 * deviceYearMultiplier / 100 
                        * batteryWearLevelMultiplier / 100 * regionMultiplier / 100;

    uint officePremium = riskPremium / (100 - loading) * 100; 
    return officePremium;
  }

  function insure(string itemId, string deviceBrand, string deviceYear, string wearLevel, string region) payable returns (bool insured) {
    require(totalInsurers < policiesLimit);

    uint totalPrice = policyPrice(deviceBrand, deviceYear, wearLevel, region);
    uint monthlyPayment = totalPrice / 12;
    
    writtenPremiumAmount += totalPrice; 

    require(msg.value >= monthlyPayment);

    var deviceData = DeviceData(itemId, deviceBrand, deviceYear, wearLevel);
    var policy = PolicyData(deviceData, now + 1 years, now + 30 days, monthlyPayment, maxPayout, totalPrice, region, false, false);

    insurancePolicies[msg.sender] = policy;
    totalInsurers = totalInsurers + 1;
    lastPolicyDate = uint32(policy.endDateTimestamp);

    Insured(deviceBrand, msg.value);
    return true;
  }

  function confirmPolicy(address policyOwner) {
    require(owner == msg.sender);

    insurancePolicies[policyOwner].confirmed = true;
  }

  function claim(uint wearLevel) returns (bool) {
    var userPolicy = insurancePolicies[msg.sender];

    if(wearLevel < 70 && userPolicy.endDateTimestamp != 0 && !userPolicy.claimed && userPolicy.endDateTimestamp > now && userPolicy.confirmed) {
      if(this.balance > userPolicy.maxPayout) {
        userPolicy.claimed = true;
        userPolicy.endDateTimestamp = now;
        userPolicy.nextPaymentTimestamp = 0;

        totalClaimsPaid = totalClaimsPaid + userPolicy.maxPayout;
        msg.sender.transfer(userPolicy.maxPayout);
        Claimed(userPolicy.maxPayout);
        return true;
      }
      // Due to proposed statisticl model in production app this should never happen
      return false;
    } else {
      throw;
    }
  }

  function getPolicyEndDateTimestamp() constant returns (uint) {
    return insurancePolicies[msg.sender].endDateTimestamp;
  }

  function getPolicyNextPayment() constant returns (uint) {
    return insurancePolicies[msg.sender].nextPaymentTimestamp;
  }

  function claimed() constant returns (bool) {
    return insurancePolicies[msg.sender].claimed;
  }

 
 //investor Part
  function invest() payable returns (bool success) {
      require(msg.value > 0);
  
      investors[msg.sender] = investors[msg.sender] + msg.value;
      totalInvestorsCount++;
      totalInvestedAmount = totalInvestedAmount + msg.value;
      Invested(msg.value);
      return true;
  }

  function isInvestmentPeriodEnded() constant returns (bool) {
    return (investmentsDeadlineTimeStamp < now);
  }

  function checkAvailableDividends() constant returns (uint) {       
    uint dividends = calculateDividends();

    return dividends;
  }

  function transferDividends() returns (bool){
    uint dividends = checkAvailableDividends();

    if(dividends > 0)
    {
      var dividendLine = DividendLine(dividends, uint32(now));

      payedDividends[msg.sender].push(dividendLine);
      payedDividendsAmount += dividends;
      msg.sender.transfer(dividends);
      DividendsPayed(dividends);
    }   
  }

  function getFreeBalance() private constant returns (int) {
    return int(writtenPremiumAmount - totalClaimsPaid);
  }

 
 function getInvestorProportion() private constant returns (uint) {
    //temproray fast calculations TODO: use model calculations
    uint investedAmount = investors[msg.sender];
    
    if (investedAmount > 0) 
    {
      uint proportion = investedAmount.mul(100).mul(uint(10)**decimalPrecision).div(totalInvestedAmount); 
      return proportion;
    }
    
    return 0;
  }

  // return weis
  function calculateDividends() private constant returns (uint) {
     // check user invested
    uint investorProportion = getInvestorProportion();
    
    if (investorProportion > 0 && totalInsurers > 0)
    {  
      int insurePackageBalance = getFreeBalance();     
      //if all policies ended
      if(now > lastPolicyDate)
      {     
        int totalFreeBalance = insurePackageBalance + int(totalInvestedAmount);
        if (insurePackageBalance > 0)
        {           
            uint investorPart = uint(totalFreeBalance).mul(uint(10)**decimalPrecision).mul(investorProportion).div(uint(100).mul(uint(10)**decimalPrecision));
            
            return investorPart.mul(uint(10)**decimalPrecision);
        }            
      }
      //policies are not ended. Return only 0.01 part from user investment as an example;
      else
      { 
        uint investedAmount = investors[msg.sender];
        var dividendsLines = payedDividends[msg.sender].length;
      
        uint availableDividend = investedAmount.div(100);
        //return 1 percent of investition on first time
        if(dividendsLines == 0)
        {
          return availableDividend; 
        } 
        else
        {
          var lastDividendDate = payedDividends[msg.sender][dividendsLines-1].transferDate;

          var dateDiff = now.sub(lastDividendDate);
          uint24 allowedDifference = 5 * 24 * 60 * 60; // allow dividends each 5 dates;

          if(dateDiff > allowedDifference)
          {
            return availableDividend;
          } 
        }        
      }
    }
    
    return 0;    
  }
}